import * as baseDebug from 'debug';
const debug = baseDebug('snyk');
import * as request from '../../request';
import * as path from 'path';
import * as fs from 'then-fs';
import * as snyk from '../..';
import * as spinner from '../../spinner';
import * as moduleToObject from 'snyk-module';
import * as isCI from '../../is-ci';
import * as _ from 'lodash';
import * as analytics from '../../analytics';
import * as common from '../common';
import * as fileSystem from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import * as detect from '../../detect';

// important: this is different from ./config (which is the *user's* config)
import * as config from '../../config';

export = test;

async function test(root, options): Promise<object> {
  const packageManager = detect.detectPackageManager(root, options);
  const payload: any = {
    // options.vulnEndpoint is only used for file system tests
    url: config.API + (options.vulnEndpoint || `/vuln/${packageManager}`),
    json: true,
    headers: {
      'x-is-ci': isCI,
      'authorization': 'token ' + snyk.api,
    },
  };
  // if the file exists, let's read the package files and post
  // the dependency tree to the server.
  // if it doesn't, then we're assuming this is an existing
  // module on npm, so send the bare argument
  const exists = await fs.exists(root);
  if (!exists) {
    const module = moduleToObject(root);
    debug('testing remote: %s', module.name + '@' + module.version);
    payload.method = 'GET';
    payload.url += '/' + encodeURIComponent(module.name + '@' + module.version);
    payload.qs = common.assembleQueryString(options);
    return await queryForVulns({package: module, payload}, null, false, root, options);
  }

  let policyLocations = [options['policy-path'] || root];
  const targetFile = options.file || detect.detectPackageFile(root);
  // this is used for Meta
  options.file = targetFile;

  const isLockFileBased = (targetFile.endsWith('package-lock.json') || targetFile.endsWith('yarn.lock'));
  if (targetFile.endsWith('yarn.lock') && getRuntimeVersion() < 6) {
    options.traverseNodeModules = true;
  }

  let pkg;
  let modules = null;
  if (isLockFileBased && !options.traverseNodeModules) {
    pkg = await generateDependenciesFromLockfile(root, options, targetFile);
  } else {
    pkg = await getDependenciesFromNodeModules(root, options, targetFile);
    modules = pkg;
  }

  policyLocations = policyLocations.concat(pluckPolicies(pkg));
  debug('policies found', policyLocations);
  analytics.add('policies', policyLocations.length);
  payload.method = 'POST';
  payload.body = pkg;
  payload.qs = common.assembleQueryString(options);

  try {
    // load all relevant policies, apply relevant options
    const policy = await snyk.policy.load(policyLocations, options);
    payload.body.policy = policy.toString();
    console.log('POLICY: ', JSON.stringify(payload.body));

  } catch (error) { // note: inline catch, to handle error from .load
    // the .snyk file wasn't found, which is fine, so we'll return
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
  // modules is either null (as defined) or was updated during the flow using node modules
  return await queryForVulns({package: pkg, payload}, modules, pkg.hasDevDependencies, root, options);
}

async function generateDependenciesFromLockfile(root, options, targetFile) {
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
  try {
    await spinner(resolveModuleSpinnerLabel);
    const strictOutOfSync = _.get(options, 'strictOutOfSync') !== 'false';
    return lockFileParser
      .buildDepTree(manifestFile.toString(), lockFile, options.dev, lockFileType, strictOutOfSync);
  } finally {
    await spinner.clear(resolveModuleSpinnerLabel);
  }
}

async function getDependenciesFromNodeModules(root, options, targetFile): Promise<any> {
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules',
  );

  const packageManager: string = detect.detectPackageManager(root, options);

  const nodeModulesExist = await fs.exists(nodeModulesPath);
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
  try {
    await spinner(resolveModuleSpinnerLabel);
    // yarn projects fall back to node_module traversal if node < 6
    if (targetFile.endsWith('yarn.lock')) {
      options.file = options.file.replace('yarn.lock', 'package.json');
    }

    // package-lock.json falls back to package.json (used in wizard code)
    if (targetFile.endsWith('package-lock.json')) {
      options.file = options.file.replace('package-lock.json', 'package.json');
    }
    const modules = snyk.modules(
      root, Object.assign({}, options, {noFromArrays: true}));
    return modules;
  } finally {
    spinner.clear(resolveModuleSpinnerLabel)();
  }
}

async function queryForVulns(data, modules, hasDevDependencies, root, options): Promise<any> {
  const lbl = 'Querying vulnerabilities database...';

  try {
    await spinner(lbl);
    const filesystemPolicy = data.payload.body && !!data.payload.body.policy;
    analytics.add('packageManager', 'npm');
    analytics.add('packageName', data.package.name);
    analytics.add('packageVersion', data.package.version);
    analytics.add('package', data.package.name + '@' + data.package.version);

    const payloadRes: any = await new Promise((resolve, reject) => {
      request(data.payload, (error, result, body) => {
        if (error) {
          return reject(error);
        }

        if (result.statusCode !== 200) {
          const err: any = new Error(body && body.error ?
            body.error :
            result.statusCode);

          err.userMessage = body && body.userMessage;
          // this is the case where a local module has been tested, but
          // doesn't have any production deps, but we've noted that they
          // have dep deps, so we'll error with a more useful message
          if (result.statusCode === 404 && hasDevDependencies) {
            err.code = 'NOT_FOUND_HAS_DEV_DEPS';
          } else {
            err.code = result.statusCode;
          }

          if (result.statusCode === 500) {
            debug('Server error', body.stack);
          }

          return reject(err);
        }

        body.filesystemPolicy = filesystemPolicy;

        resolve(body);
      });
    });

    // This branch is valid for node modules flow only
    if (modules) {
      payloadRes.dependencyCount = modules.numDependencies;
      if (payloadRes.vulnerabilities) {
        payloadRes.vulnerabilities.forEach((vuln) => {
          const plucked = modules.pluck(vuln.from, vuln.name, vuln.version);
          vuln.__filename = plucked.__filename;
          vuln.shrinkwrap = plucked.shrinkwrap;
          vuln.bundled = plucked.bundled;

          // this is an edgecase when we're testing the directly vuln pkg
          if (vuln.from.length === 1) {
            return;
          }

          const parentPkg = moduleToObject(vuln.from[1]);
          const parent = modules.pluck(vuln.from.slice(0, 2),
            parentPkg.name,
            parentPkg.version);
          vuln.parentDepType = parent.depType;
        });
      }
    }

    analytics.add('vulns-pre-policy', payloadRes.vulnerabilities.length);

    let res = payloadRes;
    if (!options['ignore-policy']) {
      const policy = await snyk.policy.loadFromText(payloadRes.policy);
      res = policy.filter(payloadRes, root);
    }
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
  } finally {
    spinner.clear(lbl)();
  }
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

  return _.flatten(Object.keys(pkg.dependencies).map((name) => {
    return pluckPolicies(pkg.dependencies[name]);
  }).filter(Boolean));
}

function getRuntimeVersion() {
  return parseInt(process.version.slice(1).split('.')[0], 10);
}
