import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';
import * as debugModule from 'debug';
import * as moduleToObject from 'snyk-module';
import * as depGraphLib from '@snyk/dep-graph';

import {
  TestResult,
  DockerIssue,
  AnnotatedIssue,
  LegacyVulnApiResult,
  TestDepGraphResponse,
  convertTestDepGraphResultToLegacy,
} from './legacy';
import {
  AuthFailedError,
  InternalServerError,
  NoSupportedManifestsFoundError,
  FailedToGetVulnerabilitiesError,
  FailedToRunTestError,
} from '../errors';
import * as snyk from '../';
import { isCI } from '../is-ci';
import * as common from './common';
import * as config from '../config';
import * as analytics from '../analytics';
import { pluckPolicies } from '../policy';
import { maybePrintDeps } from '../print-deps';
import { GitTarget } from '../project-metadata/types';
import * as projectMetadata from '../project-metadata';
import { DepTree, Options, TestOptions } from '../types';
import { countPathsToGraphRoot, pruneGraph } from '../prune';
import { SupportedPackageManagers } from '../package-managers';
import { getDepsFromPlugin } from '../plugins/get-deps-from-plugin';
import { ScannedProjectCustom } from '../plugins/get-multi-plugin-result';

import request = require('../request');
import spinner = require('../spinner');
import { getSubProjectCount } from '../plugins/get-sub-project-count';

const debug = debugModule('snyk');

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
  originalProjectName?: string; // used only for display
  foundProjectCount?: number; // used only for display
  docker?: any;
  target?: GitTarget | null;
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
  packageManager: SupportedPackageManagers | undefined,
  root: string,
  options: Options & TestOptions,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payloads = await assemblePayloads(root, options);
    for (const payload of payloads) {
      const payloadPolicy = payload.body && payload.body.policy;
      const depGraph = payload.body && payload.body.depGraph;
      const pkgManager =
        depGraph && depGraph.pkgManager && depGraph.pkgManager.name;
      const targetFile = payload.body && payload.body.targetFile;
      const projectName =
        _.get(payload, 'body.projectNameOverride') ||
        _.get(payload, 'body.originalProjectName');
      const foundProjectCount = _.get(payload, 'body.foundProjectCount');

      let dockerfilePackages;
      if (
        payload.body &&
        payload.body.docker &&
        payload.body.docker.dockerfilePackages
      ) {
        dockerfilePackages = payload.body.docker.dockerfilePackages;
      }
      await spinner(spinnerLbl);
      analytics.add('depGraph', !!depGraph);
      analytics.add('isDocker', !!(payload.body && payload.body.docker));
      // Type assertion might be a lie, but we are correcting that below
      let res = (await sendTestPayload(payload)) as LegacyVulnApiResult;

      // TODO: docker doesn't have a package manager
      // so this flow will not be applicable
      // refactor to separate
      if (depGraph && pkgManager) {
        res = convertTestDepGraphResultToLegacy(
          (res as any) as TestDepGraphResponse, // Double "as" required by Typescript for dodgy assertions
          depGraph,
          pkgManager,
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
      const result = {
        ...res,
        targetFile,
        projectName,
        foundProjectCount,
      };
      results.push(result);
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
    spinner.clear<void>(spinnerLbl)();
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
    (path.relative('.', path.join(root, options.file || '')) ||
      path.relative('..', '.') + ' project dir');

  try {
    const payloads: Payload[] = [];

    await spinner(spinnerLbl);
    const deps = await getDepsFromPlugin(root, options);
    analytics.add('pluginName', deps.plugin.name);

    for (const scannedProject of deps.scannedProjects) {
      const pkg = scannedProject.depTree;
      if (options['print-deps']) {
        await spinner.clear<void>(spinnerLbl)();
        maybePrintDeps(options, pkg);
      }
      const project = scannedProject as ScannedProjectCustom;
      const packageManager =
        project.packageManager || (deps.plugin && deps.plugin.packageManager);
      if (packageManager) {
        (options as any).packageManager = packageManager;
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
      } else if (['npm', 'yarn'].indexOf(options.packageManager!) > -1) {
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

      // todo: normalize what target file gets used across plugins and functions
      const targetFile = scannedProject.targetFile || deps.plugin.targetFile;

      let body: PayloadBody = {
        targetFile,
        projectNameOverride: options.projectName,
        originalProjectName: pkg.name,
        policy: policy && policy.toString(),
        foundProjectCount: getSubProjectCount(deps),
        docker: pkg.docker,
        hasDevDependencies: (pkg as any).hasDevDependencies,
        target: await projectMetadata.getInfo(pkg, options),
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
          options.packageManager!,
        );

        debug('done converting dep-tree to dep-graph', {
          uniquePkgsCount: depGraph.getPkgs().length,
        });
        if (options['prune-repeated-subdependencies']) {
          debug('Trying to prune the graph');
          const prePruneDepCount = countPathsToGraphRoot(depGraph);
          debug('pre prunedPathsCount: ' + prePruneDepCount);

          depGraph = await pruneGraph(depGraph, options.packageManager!);

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

      if (['yarn', 'npm'].indexOf(options.packageManager!) !== -1) {
        const isLockFileBased =
          targetFile &&
          (targetFile.endsWith('package-lock.json') ||
            targetFile.endsWith('yarn.lock'));
        if (!isLockFileBased || options.traverseNodeModules) {
          payload.modules = pkg as DepTreeFromResolveDeps; // See the output of resolve-deps
        }
      }
      payloads.push(payload);
    }
    return payloads;
  } finally {
    await spinner.clear<void>(spinnerLbl)();
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
