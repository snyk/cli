module.exports = test;

const debug = require('debug')('snyk');
const request = require('../../request');
const path = require('path');
const fs = require('then-fs');
const snyk = require('../..');
const spinner = require('../../spinner');
const moduleToObject = require('snyk-module');
const isCI = require('../../is-ci');
const _ = require('lodash');
const analytics = require('../../analytics');
const common = require('../common');
const fileSystem = require('fs');
const lockFileParser = require('snyk-nodejs-lockfile-parser');
const detect = require('../../detect');

module.exports = test;

// important: this is different from ./config (which is the *user's* config)
const config = require('../../config');

function test(root, options) {
  let modules = null;
  const packageManager = detect.detectPackageManager(root, options);
  const payload = {
    // options.vulnEndpoint is only used for file system tests
    url: config.API + (options.vulnEndpoint || `/vuln/${packageManager}`),
    json: true,
    headers: {
      'x-is-ci': isCI,
      authorization: 'token ' + snyk.api,
    },
  };
  let hasDevDependencies = false;

  // if the file exists, let's read the package files and post
  // the dependency tree to the server.
  // if it doesn't, then we're assuming this is an existing
  // module on npm, so send the bare argument
  return fs.exists(root)
    .then((exists) => {
      if (!exists) {
        const module = moduleToObject(root);
        debug('testing remote: %s', module.name + '@' + module.version);
        payload.method = 'GET';
        payload.url += '/' +
          encodeURIComponent(module.name + '@' + module.version);
        payload.qs = common.assembleQueryString(options);
        return {
          package: module,
          payload: payload,
        };
      }
      let policyLocations = [options['policy-path'] || root];
      const targetFile = options.file || detect.detectPackageFile(root);
      // this is used for Meta
      options.file = targetFile;

      return Promise.resolve()
        .then(() => {
          const isLockFilebased = (targetFile.endsWith('package-lock.json')
          || targetFile.endsWith('yarn.lock'));
          if (targetFile.endsWith('yarn.lock') && getRuntimeVersion() < 6) {
            options.traverseNodeModules = true;
          }
          if (isLockFilebased && !options.traverseNodeModules) {
            return generateDependenciesFromLockfile(root, options, targetFile);
          }
          return getDependenciesFromNodeModules(root, options, targetFile)
            .then((pkg) => {
              // HACK: using side effect (outer-scope variable mutation)
              // In this case, `pkg` is an object with methods (as opposed to a dependency tree)
              // and is used as source for .pluck() in queryForVulns().
              modules = pkg;
              return pkg;
            });
        }).then((pkg) => {
          policyLocations = policyLocations.concat(pluckPolicies(pkg));
          debug('policies found', policyLocations);
          analytics.add('policies', policyLocations.length);
          hasDevDependencies = pkg.hasDevDependencies;
          payload.method = 'POST';
          payload.body = pkg;
          payload.qs = common.assembleQueryString(options);
          // load all relevant policies, apply relevant options
          return snyk.policy.load(policyLocations, options)
            .then((policy) => {
              payload.body.policy = policy.toString();
              return {
                package: pkg,
                payload,
              };
            },(error) => { // note: inline catch, to handle error from .load
            // the .snyk file wasn't found, which is fine, so we'll return
              if (error.code === 'ENOENT') {
                return {
                  package: pkg,
                  payload,
                };
              }
              throw error;
            });
        });
    }).then((data) => {
      // modules is either null (as defined) or was updated during the flow using node modules
      return queryForVulns(data, modules, hasDevDependencies, root, options);
    });
}

function generateDependenciesFromLockfile(root, options, targetFile) {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!fileSystem.existsSync(lockFileFullPath)) {
    throw new Error('Lockfile ' + targetFile + ' not found at location: ' +
    lockFileFullPath);
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');
  const shrinkwrapFullPath = path.resolve(fullPath.dir, 'npm-shrinkwrap.json');

  if (!fileSystem.existsSync(manifestFileFullPath)) {
    throw new Error('Manifest file package.json not found at location: ' +
      manifestFileFullPath);
  }

  if (!manifestFileFullPath && lockFileFullPath) {
    throw new Error('Detected a lockfile at location: '
    + lockFileFullPath + '\n However the package.json is missing!');
  }

  if (fileSystem.existsSync(shrinkwrapFullPath)) {
    throw new Error('`npm-shrinkwrap.json` was found while using lockfile.\n'
    + 'Please run your command again without `--file=' + targetFile + '` flag.');
  }

  const manifestFile = fileSystem.readFileSync(manifestFileFullPath);
  const lockFile = fileSystem.readFileSync(lockFileFullPath, 'utf-8');

  analytics.add('local', true);
  analytics.add('generating-node-dependency-tree', {
    lockFile: true,
    targetFile,
  });

  const lockFileType = targetFile.endsWith('yarn.lock') ?
    lockFileParser.LockfileType.yarn : lockFileParser.LockfileType.npm;

  const resolveModuleSpinnerLabel = `Analyzing npm dependencies for ${lockFileFullPath}`;
  debug(resolveModuleSpinnerLabel);
  return spinner(resolveModuleSpinnerLabel)
    .then(() => {
      const strictOutOfSync = _.get(options, 'strictOutOfSync') !== 'false';

      return lockFileParser
        .buildDepTree(manifestFile, lockFile, options.dev, lockFileType, strictOutOfSync);
    })
    // clear spinner in case of success or failure
    .then(spinner.clear(resolveModuleSpinnerLabel))
    .catch((error) => {
      spinner.clear(resolveModuleSpinnerLabel)();
      throw error;
    });
}

function getDependenciesFromNodeModules(root, options, targetFile) {
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules'
  );

  const packageManager = detect.detectPackageManager(root, options);

  return fs.exists(nodeModulesPath)
    .then((nodeModulesExist) => {
      if (!nodeModulesExist) {
        // throw a custom error
        throw new Error('Missing node_modules folder: we can\'t test ' +
          `without dependencies.\nPlease run '${packageManager} install' first.`);
      }
      analytics.add('local', true);
      analytics.add('generating-node-dependency-tree', {
        lockFile: false,
        targetFile,
      });
      options.root = root;
      const resolveModuleSpinnerLabel = 'Analyzing npm dependencies for ' +
        path.dirname(path.resolve(root, targetFile));
      return spinner(resolveModuleSpinnerLabel)
        .then(() => {
          // yarn projects fall back to node_module traversal if node < 6
          if (targetFile.endsWith('yarn.lock')) {
            options.file = options.file.replace('yarn.lock', 'package.json');
          }

          //package-lock.json falls back to package.json (used in wizard code)
          if (targetFile.endsWith('package-lock.json')) {
            options.file = options.file.replace('package-lock.json', 'package.json');
          }
          return snyk.modules(
            root, Object.assign({}, options, {noFromArrays: true}));
        })
        // clear spinner in case of success or failure
        .then(spinner.clear(resolveModuleSpinnerLabel))
        .catch((error) => {
          spinner.clear(resolveModuleSpinnerLabel)();
          throw error;
        });
    });
}

function queryForVulns(data, modules, hasDevDependencies, root, options) {
  const lbl = 'Querying vulnerabilities database...';

  return spinner(lbl)
    .then(function () {
      const filesystemPolicy = data.payload.body && !!data.payload.body.policy;
      analytics.add('packageManager', 'npm');
      analytics.add('packageName', data.package.name);
      analytics.add('packageVersion', data.package.version);
      analytics.add('package', data.package.name + '@' + data.package.version);

      return new Promise(function (resolve, reject) {
        request(data.payload, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode !== 200) {
            const err = new Error(body && body.error ?
              body.error :
              res.statusCode);

            err.userMessage = body && body.userMessage;
            // this is the case where a local module has been tested, but
            // doesn't have any production deps, but we've noted that they
            // have dep deps, so we'll error with a more useful message
            if (res.statusCode === 404 && hasDevDependencies) {
              err.code = 'NOT_FOUND_HAS_DEV_DEPS';
            } else {
              err.code = res.statusCode;
            }

            if (res.statusCode === 500) {
              debug('Server error', body.stack);
            }

            return reject(err);
          }

          body.filesystemPolicy = filesystemPolicy;

          resolve(body);
        });
      });
    }).then((res) => {
      // This branch is valid for node modules flow only
      if (modules) {
        res.dependencyCount = modules.numDependencies;
        if (res.vulnerabilities) {
          res.vulnerabilities.forEach(function (vuln) {
            var plucked = modules.pluck(vuln.from, vuln.name, vuln.version);
            vuln.__filename = plucked.__filename;
            vuln.shrinkwrap = plucked.shrinkwrap;
            vuln.bundled = plucked.bundled;

            // this is an edgecase when we're testing the directly vuln pkg
            if (vuln.from.length === 1) {
              return;
            }

            var parentPkg = moduleToObject(vuln.from[1]);
            var parent = modules.pluck(vuln.from.slice(0, 2),
              parentPkg.name,
              parentPkg.version);
            vuln.parentDepType = parent.depType;
          });
        }
      }
      return res;
    }).then((res) => {
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      return Promise.resolve().then(function () {
        if (options['ignore-policy']) {
          return res;
        }

        return snyk.policy.loadFromText(res.policy)
          .then((policy) => policy.filter(res, root));
      }).then((res) => {
        analytics.add('vulns', res.vulnerabilities.length);

        // add the unique count of vulnerabilities found
        res.uniqueCount = 0;
        const seen = {};
        res.uniqueCount = res.vulnerabilities.reduce((acc, curr) => {
          if (!seen[curr.id]) {
            seen[curr.id] = true;
            acc++;
          }
          return acc;
        }, 0);

        return res;
      });
    })
    // clear spinner in case of success or failure
    .then(spinner.clear(lbl))
    .catch((error) => {
      spinner.clear(lbl)();
      throw error;
    });
}

function pluckPolicies(pkg) {
  if (!pkg) {
    return null;
  }

  if (pkg.snyk) {
    return pkg.snyk;
  }

  if (!pkg.dependencies) {
    return null;
  }

  return _.flatten(Object.keys(pkg.dependencies).map(function (name) {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}

function getRuntimeVersion() {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}
