import * as _ from 'lodash';
import * as fs from 'fs';
import pathUtil = require('path');
import moduleToObject = require('snyk-module');
import * as depGraphLib from '@snyk/dep-graph';
import analytics = require('../analytics');
import * as config from '../config';
import detect = require('../../lib/detect');
import plugins = require('../plugins');
import { ModuleInfo } from '../module-info';
import { isCI } from '../is-ci';
import request = require('../request');
import snyk = require('../');
import { Spinner } from 'cli-spinner';
import common = require('./common');
import { DepTree, TestOptions } from '../types';
import {
  convertTestDepGraphResultToLegacy,
  AnnotatedIssue,
  LegacyVulnApiResult,
  TestDepGraphResponse,
  DockerIssue,
} from './legacy';
import { Options } from '../types';
import {
  NoSupportedManifestsFoundError,
  InternalServerError,
  FailedToGetVulnerabilitiesError,
  FailedToRunTestError,
} from '../errors';
import { maybePrintDeps } from '../print-deps';
import { SupportedPackageManagers } from '../package-managers';
import { countPathsToGraphRoot, pruneGraph } from '../prune';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { AuthFailedError } from '../errors/authentication-failed-error';

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

async function runTest(
  packageManager: SupportedPackageManagers,
  root: string,
  options: Options & TestOptions,
): Promise<LegacyVulnApiResult[]> {
  const results: LegacyVulnApiResult[] = [];
  const spinner = new Spinner('Querying vulnerabilities database...');
  spinner.setSpinnerString('|/-\\');

  try {
    const payloads = await assemblePayloads(root, options);
    for (const payload of payloads) {
      const payloadPolicy = payload.body && payload.body.policy;
      const depGraph = payload.body && payload.body.depGraph;

      let dockerfilePackages;
      if (
        payload.body &&
        payload.body.docker &&
        payload.body.docker.dockerfilePackages
      ) {
        dockerfilePackages = payload.body.docker.dockerfilePackages;
      }
      spinner.start();
      analytics.add('depGraph', !!depGraph);
      analytics.add('isDocker', !!(payload.body && payload.body.docker));
      // Type assertion might be a lie, but we are correcting that below
      let res = (await sendTestPayload(payload)) as LegacyVulnApiResult;
      if (depGraph) {
        res = convertTestDepGraphResultToLegacy(
          (res as any) as TestDepGraphResponse, // Double "as" required by Typescript for dodgy assertions
          depGraph,
          packageManager,
          options.severityThreshold,
        );

        // For Node.js: inject additional information (for remediation etc.) into the response.
        if (payload.modules) {
          res.dependencyCount = payload.modules.numDependencies;
          if (res.vulnerabilities) {
            res.vulnerabilities.forEach((vuln) => {
              if (payload.modules && payload.modules.pluck) {
                const plucked = payload.modules.pluck(
                  vuln.from,
                  vuln.name,
                  vuln.version,
                );
                vuln.__filename = plucked.__filename;
                vuln.shrinkwrap = plucked.shrinkwrap;
                vuln.bundled = plucked.bundled;

                // this is an edgecase when we're testing the directly vuln pkg
                if (vuln.from.length === 1) {
                  return;
                }

                const parentPkg = moduleToObject(vuln.from[1]);
                const parent = payload.modules.pluck(
                  vuln.from.slice(0, 2),
                  parentPkg.name,
                  parentPkg.version,
                );
                vuln.parentDepType = parent.depType;
              }
            });
          }
        }
      }
      // TODO: is this needed? we filter on the other side already based on policy
      // this will move to be filtered server side soon & it will support `'ignore-policy'`
      analytics.add('vulns-pre-policy', res.vulnerabilities.length);
      res.filesystemPolicy = !!payloadPolicy;
      if (!options['ignore-policy']) {
        res.policy = res.policy || (payloadPolicy as string);
        const policy = await snyk.policy.loadFromText(res.policy);
        res = policy.filter(res, root);
      }
      analytics.add('vulns', res.vulnerabilities.length);

      if (res.docker && dockerfilePackages) {
        res.vulnerabilities = res.vulnerabilities.map((vuln) => {
          const dockerfilePackage = dockerfilePackages[vuln.name.split('/')[0]];
          if (dockerfilePackage) {
            (vuln as DockerIssue).dockerfileInstruction =
              dockerfilePackage.instruction;
          }
          (vuln as DockerIssue).dockerBaseImage = res.docker!.baseImage;
          return vuln;
        });
      }

      if (
        options.docker &&
        options.file &&
        options['exclude-base-image-vulns']
      ) {
        res.vulnerabilities = res.vulnerabilities.filter(
          (vuln) => (vuln as DockerIssue).dockerfileInstruction,
        );
      }

      res.uniqueCount = countUniqueVulns(res.vulnerabilities);
      results.push(res);
    }
    return results;
  } catch (error) {
    debug('Error running test', { error });
    // handling denial from registry because of the feature flag
    // currently done for go.mod
    if (error.code === 403 && error.message.includes('Feature not allowed')) {
      throw NoSupportedManifestsFoundError([root]);
    }

    throw new FailedToRunTestError(
      error.userMessage ||
        error.message ||
        `Failed to test ${packageManager} project`,
      error.code,
    );
  } finally {
    spinner.stop(true);
  }
}

function sendTestPayload(
  payload: Payload,
): Promise<LegacyVulnApiResult | TestDepGraphResponse> {
  const filesystemPolicy = payload.body && !!payload.body.policy;
  return new Promise((resolve, reject) => {
    request(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }
      if (res.statusCode !== 200) {
        const err = handleTestHttpErrorResponse(res, body);
        return reject(err);
      }

      body.filesystemPolicy = filesystemPolicy;

      resolve(body);
    });
  });
}

function handleTestHttpErrorResponse(res, body) {
  const { statusCode } = res;
  let err;
  const userMessage = body && body.userMessage;
  switch (statusCode) {
    case 401:
    case 403:
      err = AuthFailedError(userMessage, statusCode);
      err.innerError = body.stack;
      break;
    case 500:
      err = new InternalServerError(userMessage);
      err.innerError = body.stack;
      break;
    default:
      err = new FailedToGetVulnerabilitiesError(userMessage, statusCode);
      err.innerError = body.error;
  }
  return err;
}

function assemblePayloads(
  root: string,
  options: Options & TestOptions,
): Promise<Payload[]> {
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

// Force getDepsFromPlugin to return scannedProjects for processing in assembleLocalPayload
async function getDepsFromPlugin(
  root,
  options: Options,
): Promise<pluginApi.MultiProjectResult> {
  options.file = options.file || detect.detectPackageFile(root);
  if (!options.docker && !(options.file || options.packageManager)) {
    throw NoSupportedManifestsFoundError([...root]);
  }
  const plugin = plugins.loadPlugin(options.packageManager, options);
  const moduleInfo = ModuleInfo(plugin, options.policy);
  const inspectRes: pluginApi.InspectResult = await moduleInfo.inspect(
    root,
    options.file,
    { ...options },
  );

  if (!pluginApi.isMultiResult(inspectRes)) {
    if (!inspectRes.package) {
      // something went wrong if both are not present...
      throw Error(
        `error getting dependencies from ${options.packageManager} ` +
          "plugin: neither 'package' nor 'scannedProjects' were found",
      );
    }
    if (!inspectRes.package.targetFile && inspectRes.plugin) {
      inspectRes.package.targetFile = inspectRes.plugin.targetFile;
    }
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    if (
      inspectRes.plugin.meta &&
      inspectRes.plugin.meta.allSubProjectNames &&
      inspectRes.plugin.meta.allSubProjectNames.length > 1
    ) {
      options.advertiseSubprojectsCount =
        inspectRes.plugin.meta.allSubProjectNames.length;
    }
    return {
      plugin: inspectRes.plugin,
      scannedProjects: [{ depTree: inspectRes.package }],
    };
  } else {
    // We are using "options" to store some information returned from plugin that we need to use later,
    // but don't want to send to Registry in the Payload.
    // TODO(kyegupov): decouple inspect and payload so that we don't need this hack
    (options as any).projectNames = inspectRes.scannedProjects.map(
      (scannedProject) => scannedProject.depTree.name,
    );
    return inspectRes;
  }
}

// Payload to send to the Registry for scanning a package from the local filesystem.
async function assembleLocalPayloads(
  root,
  options: Options & TestOptions,
): Promise<Payload[]> {
  const analysisType = options.docker ? 'docker' : options.packageManager;
  const spinnerLbl =
    'Analyzing ' +
    analysisType +
    ' dependencies for ' +
    (pathUtil.relative('.', pathUtil.join(root, options.file || '')) ||
      pathUtil.relative('..', '.'));
  const spinner = new Spinner(spinnerLbl);
  spinner.setSpinnerString('|/-\\');

  try {
    const payloads: Payload[] = [];

    spinner.start();
    const deps = await getDepsFromPlugin(root, options);
    analytics.add('pluginName', deps.plugin.name);

    for (const scannedProject of deps.scannedProjects) {
      const pkg = scannedProject.depTree;
      if (options['print-deps']) {
        spinner.stop(true);
        maybePrintDeps(options, pkg);
      }
      if (deps.plugin && deps.plugin.packageManager) {
        (options as any).packageManager = deps.plugin.packageManager;
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
        targetFile: pkg.targetFile,
        projectNameOverride: options.projectName,
        policy: policy && policy.toString(),
        docker: pkg.docker,
        hasDevDependencies: (pkg as any).hasDevDependencies,
      };

      if (options.vulnEndpoint) {
        // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests).
        body = { ...body, ...pkg };
      } else {
        // Graphs are more compact and robust representations.
        // Legacy parts of the code are still using trees, but will eventually be fully migrated.
        debug('converting dep-tree to dep-graph', {
          name: pkg.name,
          targetFile: scannedProject.targetFile || options.file,
        });
        let depGraph = await depGraphLib.legacy.depTreeToGraph(
          pkg,
          options.packageManager,
        );

        debug('done converting dep-tree to dep-graph', {
          uniquePkgsCount: depGraph.getPkgs().length,
        });
        if (options['prune-repeated-subdependencies']) {
          debug('Trying to prune the graph');
          const prePruneDepCount = countPathsToGraphRoot(depGraph);
          debug('pre prunedPathsCount: ' + prePruneDepCount);

          depGraph = await pruneGraph(depGraph, options.packageManager);

          analytics.add('prePrunedPathsCount', prePruneDepCount);
          const postPruneDepCount = countPathsToGraphRoot(depGraph);
          debug('post prunedPathsCount: ' + postPruneDepCount);
          analytics.add('postPrunedPathsCount', postPruneDepCount);
        }
        body.depGraph = depGraph;
      }

      const payload: Payload = {
        method: 'POST',
        url: config.API + (options.vulnEndpoint || '/test-dep-graph'),
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: 'token ' + (snyk as any).api,
        },
        qs: common.assembleQueryString(options),
        body,
      };

      if (['yarn', 'npm'].indexOf(options.packageManager) !== -1) {
        const isLockFileBased =
          options.file &&
          (options.file.endsWith('package-lock.json') ||
            options.file.endsWith('yarn.lock'));
        if (!isLockFileBased || options.traverseNodeModules) {
          payload.modules = pkg as DepTreeFromResolveDeps; // See the output of resolve-deps
        }
      }

      payloads.push(payload);
    }
    return payloads;
  } finally {
    await spinner.stop(true);
  }
}

// Payload to send to the Registry for scanning a remote package.
async function assembleRemotePayloads(root, options): Promise<Payload[]> {
  const pkg = moduleToObject(root);
  debug('testing remote: %s', pkg.name + '@' + pkg.version);
  addPackageAnalytics(pkg);
  const encodedName = encodeURIComponent(pkg.name + '@' + pkg.version);
  // options.vulnEndpoint is only used by `snyk protect` (i.e. local filesystem tests)
  const url = `${config.API}${options.vulnEndpoint ||
    `/vuln/${options.packageManager}`}/${encodedName}`;
  return [
    {
      method: 'GET',
      url,
      qs: common.assembleQueryString(options),
      json: true,
      headers: {
        'x-is-ci': isCI(),
        authorization: 'token ' + snyk.api,
      },
    },
  ];
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

  return _.flatten(
    Object.keys(pkg.dependencies)
      .map((name) => {
        return pluckPolicies(pkg.dependencies[name]);
      })
      .filter(Boolean),
  );
}
