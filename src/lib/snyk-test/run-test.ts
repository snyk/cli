import * as fs from 'fs';
import * as _ from '@snyk/lodash';
import * as path from 'path';
import * as debugModule from 'debug';
import * as pathUtil from 'path';
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
  FailedToGetVulnsFromUnavailableResource,
  FailedToRunTestError,
  UnsupportedFeatureFlagError,
} from '../errors';
import * as snyk from '../';
import { isCI } from '../is-ci';
import * as common from './common';
import * as config from '../config';
import * as analytics from '../analytics';
import { pluckPolicies } from '../policy';
import { maybePrintDeps } from '../print-deps';
import { GitTarget, ContainerTarget } from '../project-metadata/types';
import * as projectMetadata from '../project-metadata';
import { DepTree, Options, TestOptions, SupportedProjectTypes } from '../types';
import { countPathsToGraphRoot, pruneGraph } from '../prune';
import { getDepsFromPlugin } from '../plugins/get-deps-from-plugin';
import { ScannedProjectCustom } from '../plugins/get-multi-plugin-result';

import request = require('../request');
import spinner = require('../spinner');
import { extractPackageManager } from '../plugins/extract-package-manager';
import { getSubProjectCount } from '../plugins/get-sub-project-count';
import { serializeCallGraphWithMetrics } from '../reachable-vulns';
import { validateOptions } from '../options-validator';

const debug = debugModule('snyk');

export = runTest;

interface DepTreeFromResolveDeps extends DepTree {
  numDependencies: number;
  pluck: any;
}

interface PayloadBody {
  depGraph?: depGraphLib.DepGraph; // missing for legacy endpoint (options.vulnEndpoint)
  callGraph?: any;
  policy: string;
  targetFile?: string;
  targetFileRelativePath?: string;
  projectNameOverride?: string;
  hasDevDependencies?: boolean;
  originalProjectName?: string; // used only for display
  foundProjectCount?: number; // used only for display
  docker?: any;
  displayTargetFile?: string;
  target?: GitTarget | ContainerTarget | null;
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
  projectType: SupportedProjectTypes | undefined,
  root: string,
  options: Options & TestOptions,
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    await validateOptions(options, options.packageManager);
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
      const displayTargetFile = _.get(payload, 'body.displayTargetFile');

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
      const res = (await sendTestPayload(payload)) as LegacyVulnApiResult;

      const result = await parseRes(
        depGraph,
        pkgManager,
        res,
        options,
        payload,
        payloadPolicy,
        root,
        dockerfilePackages,
      );

      results.push({
        ...result,
        targetFile,
        projectName,
        foundProjectCount,
        displayTargetFile,
      });
    }
    return results;
  } catch (error) {
    debug('Error running test', { error });
    // handling denial from registry because of the feature flag
    // currently done for go.mod
    const isFeatureNotAllowed =
      error.code === 403 && error.message.includes('Feature not allowed');

    const hasFailedToGetVulnerabilities =
      error.code === 404 &&
      error.name.includes('FailedToGetVulnerabilitiesError');

    if (isFeatureNotAllowed) {
      throw NoSupportedManifestsFoundError([root]);
    }
    if (hasFailedToGetVulnerabilities) {
      throw FailedToGetVulnsFromUnavailableResource(root, error.code);
    }

    throw new FailedToRunTestError(
      error.userMessage ||
        error.message ||
        `Failed to test ${projectType} project`,
      error.code,
    );
  } finally {
    spinner.clear<void>(spinnerLbl)();
  }
}

async function parseRes(
  depGraph: depGraphLib.DepGraph | undefined,
  pkgManager: string | undefined,
  res: LegacyVulnApiResult,
  options: Options & TestOptions,
  payload: Payload,
  payloadPolicy: string | undefined,
  root: string,
  dockerfilePackages: any,
): Promise<TestResult> {
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
  if (options.docker && options.file && options['exclude-base-image-vulns']) {
    res.vulnerabilities = res.vulnerabilities.filter(
      (vuln) => (vuln as DockerIssue).dockerfileInstruction,
    );
  }

  res.uniqueCount = countUniqueVulns(res.vulnerabilities);

  return res;
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
    case 405:
      err = new UnsupportedFeatureFlagError('reachableVulns');
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
  // For --all-projects packageManager is yet undefined here. Use 'all'
  const analysisType =
    (options.docker ? 'docker' : options.packageManager) || 'all';
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
    const javaVersion = _.get(
      deps.plugin,
      'meta.versionBuildInfo.metaBuildVersion.javaVersion',
      null,
    );
    const mvnVersion = _.get(
      deps.plugin,
      'meta.versionBuildInfo.metaBuildVersion.mvnVersion',
      null,
    );
    if (javaVersion) {
      analytics.add('javaVersion', javaVersion);
    }
    if (mvnVersion) {
      analytics.add('mvnVersion', mvnVersion);
    }

    for (const scannedProject of deps.scannedProjects) {
      const pkg = scannedProject.depTree;
      if (options['print-deps']) {
        await spinner.clear<void>(spinnerLbl)();
        maybePrintDeps(options, pkg);
      }
      const project = scannedProject as ScannedProjectCustom;
      const packageManager = extractPackageManager(project, deps, options);

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
      } else if (
        packageManager &&
        ['npm', 'yarn'].indexOf(packageManager) > -1
      ) {
        policyLocations = policyLocations.concat(pluckPolicies(pkg));
      }
      debug('policies found', policyLocations);

      analytics.add('policies', policyLocations.length);
      analytics.add('packageManager', packageManager);
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
      const targetFile =
        scannedProject.targetFile || deps.plugin.targetFile || options.file;

      // Forcing options.path to be a string as pathUtil requires is to be stringified
      const targetFileRelativePath = targetFile
        ? pathUtil.join(pathUtil.resolve(`${options.path}`), targetFile)
        : '';

      let body: PayloadBody = {
        // WARNING: be careful changing this as it affects project uniqueness
        targetFile: project.plugin.targetFile,

        // TODO: Remove relativePath prop once we gather enough ruby related logs
        targetFileRelativePath: `${targetFileRelativePath}`, // Forcing string
        projectNameOverride: options.projectName,
        originalProjectName: pkg.name,
        policy: policy && policy.toString(),
        foundProjectCount: getSubProjectCount(deps),
        displayTargetFile: targetFile,
        docker: pkg.docker,
        hasDevDependencies: (pkg as any).hasDevDependencies,
        target: await projectMetadata.getInfo(scannedProject, pkg, options),
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
          packageManager!,
        );

        debug('done converting dep-tree to dep-graph', {
          uniquePkgsCount: depGraph.getPkgs().length,
        });
        if (options['prune-repeated-subdependencies'] && packageManager) {
          debug('Trying to prune the graph');
          const prePruneDepCount = countPathsToGraphRoot(depGraph);
          debug('pre prunedPathsCount: ' + prePruneDepCount);

          depGraph = await pruneGraph(depGraph, packageManager);

          analytics.add('prePrunedPathsCount', prePruneDepCount);
          const postPruneDepCount = countPathsToGraphRoot(depGraph);
          debug('post prunedPathsCount: ' + postPruneDepCount);
          analytics.add('postPrunedPathsCount', postPruneDepCount);
        }
        body.depGraph = depGraph;
      }

      if (scannedProject.callGraph) {
        const {
          callGraph,
          nodeCount,
          edgeCount,
        } = serializeCallGraphWithMetrics(scannedProject.callGraph);
        debug(
          `Adding call graph to payload, node count: ${nodeCount}, edge count: ${edgeCount}`,
        );

        const callGraphMetrics = _.get(
          deps.plugin,
          'meta.callGraphMetrics',
          {},
        );
        analytics.add('callGraphMetrics', {
          callGraphEdgeCount: edgeCount,
          callGraphNodeCount: nodeCount,
          ...callGraphMetrics,
        });
        body.callGraph = callGraph;
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

      if (packageManager && ['yarn', 'npm'].indexOf(packageManager) !== -1) {
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
