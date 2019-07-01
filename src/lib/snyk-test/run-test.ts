import * as _ from 'lodash';
import fs = require('then-fs');
import pathUtil = require('path');
import moduleToObject = require('snyk-module');
import * as depGraphLib from '@snyk/dep-graph';

import analytics = require('../analytics');
import * as config from '../config';
import detect = require('../../lib/detect');
import plugins = require('../plugins');
import {ModuleInfo} from '../module-info';
import {isCI} from '../is-ci';
import request = require('../request');
import snyk = require('../');
import spinner = require('../spinner');
import common = require('./common');
import {DepTree, TestOptions} from '../types';
import gemfileLockToDependencies = require('../../lib/plugins/rubygems/gemfile-lock-to-dependencies');
import {convertTestDepGraphResultToLegacy, AnnotatedIssue, LegacyVulnApiResult, TestDepGraphResponse} from './legacy';
import {SingleDepRootResult, MultiDepRootsResult, isMultiResult, Options} from '../types';
import { NoSupportedManifestsFoundError } from '../errors';
import { maybePrintDeps } from '../print-deps';
import { SupportedPackageManagers } from '../package-managers';

// tslint:disable-next-line:no-var-requires
const debug = require('debug')('snyk');

export = runTest;

interface DepTreeFromResolveDeps extends DepTree {
  numDependencies: number;
  pluck: any;
}

interface PayloadBody {
  depGraph?: depGraphLib.DepGraph; // missing for legacy endpoint (options.vulnEndpoint)
  policy: string;
  targetFile?: string;
  projectNameOverride?: string;
  hasDevDependencies?: boolean;
  docker?: any;
}

interface Payload {
  method: string;
  url: string;
  json: boolean;
  headers: {
    'x-is-ci': boolean;
    authorization: string;
  };
  body?: PayloadBody;
  qs?: object | null;
  modules?: DepTreeFromResolveDeps;
}

async function runTest(packageManager: SupportedPackageManagers,
                       root: string, options: Options & TestOptions): Promise<LegacyVulnApiResult[]> {
  const results: LegacyVulnApiResult[] = [];
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payloads = await assemblePayloads(root, options);
    for (const payload of payloads) {
      const hasDevDependencies = payload.body && !!payload.body.hasDevDependencies || false;
      const payloadPolicy = payload.body && payload.body.policy;
      const depGraph = payload.body && payload.body.depGraph;

      let dockerfilePackages;
      if (payload.body && payload.body.docker && payload.body.docker.dockerfilePackages) {
        dockerfilePackages = payload.body.docker.dockerfilePackages;
      }

      await spinner(spinnerLbl);
      analytics.add('depGraph', depGraph);
      analytics.add('isDocker', payload.body && payload.body.docker);
      // Type assertion might be a lie, but we are correcting that below
      let res = await sendPayload(payload, hasDevDependencies) as LegacyVulnApiResult;
      if (depGraph) {
        res = convertTestDepGraphResultToLegacy(
          res as any as TestDepGraphResponse, // Double "as" required by Typescript for dodgy assertions
          depGraph,
          packageManager,
          options.severityThreshold);

        // For Node.js: inject additional information (for remediation etc.) into the response.
        if (payload.modules) {
          res.dependencyCount = payload.modules.numDependencies;
          if (res.vulnerabilities) {
            res.vulnerabilities.forEach((vuln) => {
              if (payload.modules && payload.modules.pluck) {
                const plucked = payload.modules.pluck(vuln.from, vuln.name, vuln.version);
                vuln.__filename = plucked.__filename;
                vuln.shrinkwrap = plucked.shrinkwrap;
                vuln.bundled = plucked.bundled;

                // this is an edgecase when we're testing the directly vuln pkg
                if (vuln.from.length === 1) {
                  return;
                }

                const parentPkg = moduleToObject(vuln.from[1]);
                const parent = payload.modules.pluck(vuln.from.slice(0, 2),
                  parentPkg.name,
                  parentPkg.version);
                vuln.parentDepType = parent.depType;
              }
            });
          }
        }
      }

      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      res.filesystemPolicy = !!payloadPolicy;
      if (!options['ignore-policy']) {
        res.policy = res.policy || payloadPolicy as string;
        const policy = await snyk.policy.loadFromText(res.policy);
        res = policy.filter(res, root);
      }
      analytics.add('vulns', res.vulnerabilities.length);

      if (res.docker && dockerfilePackages) {
        res.vulnerabilities = res.vulnerabilities.map((vuln) => {
          const dockerfilePackage = dockerfilePackages[vuln.name.split('/')[0]];
          if (dockerfilePackage) {
            vuln.dockerfileInstruction = dockerfilePackage.instruction;
          }
          vuln.dockerBaseImage = res.docker!.baseImage;
          return vuln;
        });
      }

      if (options.docker && options.file && options['exclude-base-image-vulns']) {
        res.vulnerabilities = res.vulnerabilities.filter((vuln) => (vuln.dockerfileInstruction));
      }

      res.uniqueCount = countUniqueVulns(res.vulnerabilities);
      results.push(res);
    }
    return results;
  } catch (err) {
    // handling denial from registry because of the feature flag
    // currently done for go.mod
    if (err.code === 403 && err.message.includes('Feature not allowed')) {
      throw NoSupportedManifestsFoundError([root]);
    }

    throw err;
  } finally {
    spinner.clear(spinnerLbl)();
  }
}

function sendPayload(payload: Payload, hasDevDependencies: boolean):
    Promise<LegacyVulnApiResult | TestDepGraphResponse> {
  const filesystemPolicy = payload.body && !!payload.body.policy;
  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      if (res.statusCode !== 200) {
        const err = new Error(body && body.error ?
          body.error :
          res.statusCode);

        (err as any).userMessage = body && body.userMessage;
        // this is the case where a local module has been tested, but
        // doesn't have any production deps, but we've noted that they
        // have dep deps, so we'll error with a more useful message
        if (res.statusCode === 404 && hasDevDependencies) {
          (err as any).code = 'NOT_FOUND_HAS_DEV_DEPS';
        } else {
          (err as any).code = res.statusCode;
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
}

function assemblePayloads(root: string, options: Options & TestOptions): Promise<Payload[]> {
  let isLocal;
  if (options.docker) {
    isLocal = true;
  } else {
    // TODO: Refactor this check so we don't require files when tests are using mocks
    isLocal = fs.existsSync(root);
  }
  analytics.add('local', isLocal);
  if (isLocal) {
    return assembleLocalPayloads(root, options);
  }
  return assembleRemotePayloads(root, options);
}

// Force getDepsFromPlugin to return depRoots for processing in assembleLocalPayload
async function getDepsFromPlugin(root, options: Options): Promise<MultiDepRootsResult> {
  options.file = options.file || detect.detectPackageFile(root);
  if (!options.docker && !(options.file || options.packageManager)) {
    throw NoSupportedManifestsFoundError([...root]);
  }
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const pluginOptions = plugins.getPluginOptions(options.packageManager, options);
  const inspectRes: SingleDepRootResult | MultiDepRootsResult =
    await moduleInfo.inspect(root, options.file, { ...options, ...pluginOptions });

  if (!isMultiResult(inspectRes)) {
    if (!inspectRes.package) {
      // something went wrong if both are not present...
      throw Error(`error getting dependencies from ${options.packageManager} ` +
                  'plugin: neither \'package\' nor \'depRoots\' were found');
    }
    if (!inspectRes.package.targetFile && inspectRes.plugin) {
      inspectRes.package.targetFile = inspectRes.plugin.targetFile;
    }
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    if (inspectRes.plugin.meta
      && inspectRes.plugin.meta.allSubProjectNames
      && inspectRes.plugin.meta.allSubProjectNames.length > 1) {
      options.advertiseSubprojectsCount = inspectRes.plugin.meta.allSubProjectNames.length;
    }
    return {
      plugin: inspectRes.plugin,
      depRoots: [{depTree: inspectRes.package}],
    };
  } else {
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    options.subProjectNames = inspectRes.depRoots.map((depRoot) => depRoot.depTree.name);
    return inspectRes;
  }
}

// Payload to send to the Registry for scanning a package from the local filesystem.
async function assembleLocalPayloads(root, options: Options & TestOptions): Promise<Payload[]> {
  const analysisType = options.docker ? 'docker' : options.packageManager;
  const spinnerLbl = 'Analyzing ' + analysisType + ' dependencies for ' +
     (pathUtil.relative('.', pathUtil.join(root, options.file || '')) ||
       (pathUtil.relative('..', '.') + ' project dir'));

  try {
    const payloads: Payload[] = [];

    await spinner(spinnerLbl);
    const deps = await getDepsFromPlugin(root, options);

    for (const depRoot of deps.depRoots) {
      const pkg = depRoot.depTree;
      if (options['print-deps']) {
        await spinner.clear(spinnerLbl)();
        maybePrintDeps(options, pkg);
      }
      if (deps.plugin && deps.plugin.packageManager) {
        options.packageManager = deps.plugin.packageManager;
      }

      if (pkg.docker) {
        const baseImageFromDockerfile = pkg.docker.baseImage;
        if (!baseImageFromDockerfile && options['base-image']) {
          pkg.docker.baseImage = options['base-image'];
        }

        if (baseImageFromDockerfile && deps.plugin && deps.plugin.imageLayers) {
          analytics.add('BaseImage', baseImageFromDockerfile);
          analytics.add('imageLayers', deps.plugin.imageLayers);
        }
      }

      if (_.get(pkg, 'files.gemfileLock.contents')) {
        const gemfileLockBase64 = pkg.files.gemfileLock.contents;
        const gemfileLockContents = Buffer.from(gemfileLockBase64, 'base64').toString();
        pkg.dependencies = gemfileLockToDependencies(gemfileLockContents);
      }

      let policyLocations: string[] = [options['policy-path'] || root];
      if (options.docker) {
        policyLocations = policyLocations.filter((loc) => {
          return loc !== root;
        });
      } else if (['npm', 'yarn'].indexOf(options.packageManager) > -1) {
        policyLocations = policyLocations.concat(pluckPolicies(pkg));
      }
      debug('policies found', policyLocations);

      analytics.add('policies', policyLocations.length);
      analytics.add('packageManager', options.packageManager);
      addPackageAnalytics(pkg);

      let policy;
      if (policyLocations.length > 0) {
        try {
          policy = await snyk.policy.load(policyLocations, options);
        } catch (err) {
          // note: inline catch, to handle error from .load
          //   if the .snyk file wasn't found, it is fine
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }
      }

      let body: PayloadBody = {
        targetFile: pkg.targetFile || options.file,
        projectNameOverride: options.projectName,
        policy: policy && policy.toString(),
        docker: pkg.docker,
        hasDevDependencies: (pkg as any).hasDevDependencies,
      };

      if (options.vulnEndpoint) {
        // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests).
        body = {...body, ...pkg};
      } else {
        // Graphs are more compact and robust representations.
        // Legacy parts of the code are still using trees, but will eventually be fully migrated.
        debug('converting dep-tree to dep-graph', {name: pkg.name, targetFile: depRoot.targetFile || options.file});
        const depGraph = await depGraphLib.legacy.depTreeToGraph(
          pkg, options.packageManager);
        debug('done converting dep-tree to dep-graph', {uniquePkgsCount: depGraph.getPkgs().length});
        body.depGraph = depGraph;
      }

      const payload: Payload = {
        method: 'POST',
        url: config.API + (options.vulnEndpoint || '/test-dep-graph'),
        json: true,
        headers: {
          'x-is-ci': isCI(),
          'authorization': 'token ' + (snyk as any).api,
        },
        qs: common.assembleQueryString(options),
        body,
      };

      if (['yarn', 'npm'].indexOf(options.packageManager) !== -1) {
        const isLockFileBased = options.file
        && (options.file.endsWith('package-lock.json') || options.file.endsWith('yarn.lock'));
        if (!isLockFileBased || options.traverseNodeModules) {
          payload.modules = pkg as DepTreeFromResolveDeps; // See the output of resolve-deps
        }
      }

      payloads.push(payload);
    }
    return payloads;
  } finally {
    await spinner.clear(spinnerLbl)();
  }
}

// Payload to send to the Registry for scanning a remote package.
async function assembleRemotePayloads(root, options): Promise<Payload[]> {
  const pkg = moduleToObject(root);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  addPackageAnalytics(pkg);
  const encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests)
  const url = `${config.API}${(options.vulnEndpoint || `/vuln/${options.packageManager}`)}/${encodedName}`;
  return [{
    method: 'GET',
    url,
    qs: common.assembleQueryString(options),
    json: true,
    headers: {
      'x-is-ci': isCI(),
      'authorization': 'token ' + snyk.api,
    },
  }];
}

function addPackageAnalytics(module): void {
  analytics.add('packageName', module.name);
  analytics.add('packageVersion', module.version);
  analytics.add('package', module.name + '@' + module.version);
}

function countUniqueVulns(vulns: AnnotatedIssue[]): number {
  const seen = {};
  for (const curr of vulns) {
    seen[curr.id] = true;
  }
  return Object.keys(seen).length;
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
