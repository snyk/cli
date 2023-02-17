import * as fs from 'fs';
import * as get from 'lodash.get';
import * as path from 'path';
import * as pathUtil from 'path';
import * as debugModule from 'debug';
import chalk from 'chalk';
import { icon } from '../theme';
import { parsePackageString as moduleToObject } from 'snyk-module';
import * as depGraphLib from '@snyk/dep-graph';
import * as theme from '../../lib/theme';
import { jsonStringifyLargeObject } from '../../lib/json';

import {
  AffectedPackages,
  AnnotatedIssue,
  convertTestDepGraphResultToLegacy,
  DockerIssue,
  LegacyVulnApiResult,
  TestDependenciesResponse,
  TestDepGraphResponse,
  TestResult,
} from './legacy';
import {
  AuthFailedError,
  DockerImageNotFoundError,
  FailedToGetVulnerabilitiesError,
  FailedToGetVulnsFromUnavailableResource,
  FailedToRunTestError,
  InternalServerError,
  NoSupportedManifestsFoundError,
  NotFoundError,
  errorMessageWithRetry,
} from '../errors';
import * as snyk from '../';
import { isCI } from '../is-ci';
import * as common from './common';
import config from '../config';
import * as analytics from '../analytics';
import { maybePrintDepGraph, maybePrintDepTree } from '../print-deps';
import { ContainerTarget, GitTarget } from '../project-metadata/types';
import * as projectMetadata from '../project-metadata';
import {
  DepTree,
  Options,
  PolicyOptions,
  SupportedProjectTypes,
  TestOptions,
} from '../types';
import { pruneGraph } from '../prune';
import { getDepsFromPlugin } from '../plugins/get-deps-from-plugin';
import {
  MultiProjectResultCustom,
  ScannedProjectCustom,
} from '../plugins/get-multi-plugin-result';
import { extractPackageManager } from '../plugins/extract-package-manager';
import { getExtraProjectCount } from '../plugins/get-extra-project-count';
import { findAndLoadPolicy } from '../policy';
import {
  Payload,
  PayloadBody,
  DepTreeFromResolveDeps,
  TestDependenciesRequest,
} from './types';
import { getAuthHeader } from '../api-token';
import { getEcosystem } from '../ecosystems';
import { Issue } from '../ecosystems/types';
import { assembleEcosystemPayloads } from './assemble-payloads';
import { makeRequest } from '../request';
import { spinner } from '../spinner';
import { hasUnknownVersions } from '../dep-graph';

const debug = debugModule('snyk:run-test');

// Controls the number of simultaneous test requests that can be in-flight.
const MAX_CONCURRENCY = 5;

function prepareResponseForParsing(
  payload: Payload,
  response: TestDependenciesResponse,
  options: Options & TestOptions,
): any {
  const ecosystem = getEcosystem(options);
  return ecosystem
    ? prepareEcosystemResponseForParsing(payload, response, options)
    : prepareLanguagesResponseForParsing(payload);
}

function prepareEcosystemResponseForParsing(
  payload: Payload,
  response: TestDependenciesResponse,
  options: Options & TestOptions,
) {
  const testDependenciesRequest = payload.body as
    | TestDependenciesRequest
    | undefined;
  const payloadBody = testDependenciesRequest?.scanResult;
  const depGraphData: depGraphLib.DepGraphData | undefined =
    response?.result?.depGraphData;
  const depGraph =
    depGraphData !== undefined
      ? depGraphLib.createFromJSON(depGraphData)
      : undefined;
  const imageUserInstructions = payloadBody?.facts.find(
    (fact) =>
      fact.type === 'dockerfileAnalysis' ||
      fact.type === 'autoDetectedUserInstructions',
  );

  const dockerfilePackages = imageUserInstructions?.data?.dockerfilePackages;
  const projectName = payloadBody?.name || depGraph?.rootPkg.name;
  const packageManager = payloadBody?.identity?.type as SupportedProjectTypes;
  const targetFile = payloadBody?.identity?.targetFile || options.file;
  const platform = payloadBody?.identity?.args?.platform;

  analytics.add('depGraph', !!depGraph);
  analytics.add('isDocker', !!options.docker);

  return {
    depGraph,
    dockerfilePackages,
    projectName,
    targetFile,
    pkgManager: packageManager,
    displayTargetFile: targetFile,
    foundProjectCount: undefined,
    payloadPolicy: payloadBody?.policy,
    platform,
    scanResult: payloadBody,
    hasUnknownVersions: hasUnknownVersions(depGraph),
  };
}

function prepareLanguagesResponseForParsing(payload: Payload) {
  const payloadBody = payload.body as PayloadBody | undefined;
  const payloadPolicy = payloadBody && payloadBody.policy;
  const depGraph = payloadBody && payloadBody.depGraph;
  const pkgManager =
    depGraph &&
    depGraph.pkgManager &&
    (depGraph.pkgManager.name as SupportedProjectTypes);
  const targetFile = payloadBody && payloadBody.targetFile;
  const projectName =
    payloadBody?.projectNameOverride || payloadBody?.originalProjectName;
  const foundProjectCount = payloadBody?.foundProjectCount;
  const displayTargetFile = payloadBody?.displayTargetFile;
  let dockerfilePackages;
  if (
    payloadBody &&
    payloadBody.docker &&
    payloadBody.docker.dockerfilePackages
  ) {
    dockerfilePackages = payloadBody.docker.dockerfilePackages;
  }
  analytics.add('depGraph', !!depGraph);
  analytics.add('isDocker', !!(payloadBody && payloadBody.docker));
  return {
    depGraph,
    payloadPolicy,
    pkgManager,
    targetFile,
    projectName,
    foundProjectCount,
    displayTargetFile,
    dockerfilePackages,
    hasUnknownVersions: hasUnknownVersions(depGraph),
  };
}

function isTestDependenciesResponse(
  response:
    | TestDepGraphResponse
    | TestDependenciesResponse
    | LegacyVulnApiResult,
): response is TestDependenciesResponse {
  const assumedTestDependenciesResponse = response as TestDependenciesResponse;
  return assumedTestDependenciesResponse?.result?.issues !== undefined;
}

function convertIssuesToAffectedPkgs(
  response:
    | TestDepGraphResponse
    | TestDependenciesResponse
    | LegacyVulnApiResult,
): TestDepGraphResponse | TestDependenciesResponse | LegacyVulnApiResult {
  if (!(response as any).result) {
    return response;
  }

  if (!isTestDependenciesResponse(response)) {
    return response;
  }

  response.result['affectedPkgs'] = getAffectedPkgsFromIssues(
    response.result.issues,
  );
  return response;
}

function getAffectedPkgsFromIssues(issues: Issue[]): AffectedPackages {
  const result: AffectedPackages = {};

  for (const issue of issues) {
    const packageId = `${issue.pkgName}@${issue.pkgVersion || ''}`;

    if (result[packageId] === undefined) {
      result[packageId] = {
        pkg: { name: issue.pkgName, version: issue.pkgVersion },
        issues: {},
      };
    }

    result[packageId].issues[issue.issueId] = issue;
  }

  return result;
}

async function sendAndParseResults(
  payloads: Payload[],
  spinnerLbl: string,
  root: string,
  options: Options & TestOptions,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  await spinner.clear<void>(spinnerLbl)();
  if (!options.quiet) {
    await spinner(spinnerLbl);
  }

  type TestResponse = {
    payload: Payload;
    originalPayload: Payload;
    response: any;
  };
  const requests: (() => Promise<TestResponse>)[] = [];
  for (const payload of payloads) {
    const request = async (): Promise<TestResponse> => {
      /** sendTestPayload() deletes the request.body from the payload once completed. */
      const originalPayload = Object.assign({}, payload);
      const response = await sendTestPayload(payload);
      return { payload, originalPayload, response };
    };
    requests.push(request);
  }

  // Start block adapted from https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b?permalink_comment_id=3591045#gistcomment-3591045
  let index = 0;
  const responses: TestResponse[] = [];

  const execRequest = async () => {
    while (index < requests.length) {
      // index is shared across "threads", so capture the current value for this
      // iteration on this "thread" and increment it for the rest of the world.
      const curIndex = index++;
      responses[curIndex] = await requests[curIndex]();
    }
  };

  const threads: Promise<void>[] = [];
  for (let thread = 0; thread < MAX_CONCURRENCY; thread++) {
    threads.push(execRequest());
  }
  await Promise.all(threads);
  // End block adapted from https://gist.github.com/jcouyang/632709f30e12a7879a73e9e132c0d56b?permalink_comment_id=3591045#gistcomment-3591045

  for (const { payload, originalPayload, response } of responses) {
    const {
      depGraph,
      payloadPolicy,
      pkgManager,
      targetFile,
      projectName,
      foundProjectCount,
      displayTargetFile,
      dockerfilePackages,
      platform,
      scanResult,
      hasUnknownVersions,
    } = prepareResponseForParsing(
      originalPayload,
      response as TestDependenciesResponse,
      options,
    );

    const ecosystem = getEcosystem(options);
    if (ecosystem && options['print-deps']) {
      await spinner.clear<void>(spinnerLbl)();
      await maybePrintDepGraph(options, depGraph);
    }

    const legacyRes = convertIssuesToAffectedPkgs(response);

    const result = await parseRes(
      depGraph,
      pkgManager,
      legacyRes as LegacyVulnApiResult,
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
      platform,
      scanResult,
      hasUnknownVersions,
    });
  }
  return results;
}

export async function runTest(
  projectType: SupportedProjectTypes | undefined,
  root: string,
  options: Options & TestOptions,
): Promise<TestResult[]> {
  const spinnerLbl = 'Querying vulnerabilities database...';
  try {
    const payloads = await assemblePayloads(root, options);

    if (options['print-graph'] && !options['print-deps']) {
      const results: TestResult[] = [];
      return results;
    }

    return await sendAndParseResults(payloads, spinnerLbl, root, options);
  } catch (error) {
    debug('Error running test', { error });
    // handling denial from registry because of the feature flag
    // currently done for go.mod
    const isFeatureNotAllowed =
      error.code === 403 && error.message.includes('Feature not allowed');

    const hasFailedToGetVulnerabilities =
      error.code === 404 &&
      error.name.includes('FailedToGetVulnerabilitiesError') &&
      !error.userMessage;

    if (isFeatureNotAllowed) {
      throw NoSupportedManifestsFoundError([root]);
    }
    if (hasFailedToGetVulnerabilities) {
      throw FailedToGetVulnsFromUnavailableResource(root, error.code);
    }
    if (
      getEcosystem(options) === 'docker' &&
      error.statusCode === 401 &&
      [
        'authentication required',
        '{"details":"incorrect username or password"}\n',
      ].includes(error.message)
    ) {
      throw new DockerImageNotFoundError(root);
    }

    throw new FailedToRunTestError(
      error.userMessage ||
        error.message ||
        `Failed to test ${projectType} project`,
      error.code,
      error.innerError,
    );
  } finally {
    spinner.clear<void>(spinnerLbl)();
  }
}

async function parseRes(
  depGraph: depGraphLib.DepGraph | undefined,
  pkgManager: SupportedProjectTypes | undefined,
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
      options,
    );
    // For Node.js: inject additional information (for remediation etc.) into the response.
    if (payload.modules) {
      res.dependencyCount =
        payload.modules.numDependencies || depGraph.getPkgs().length - 1;
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
          dockerfilePackage.installCommand;
      }
      (vuln as DockerIssue).dockerBaseImage = res.docker!.baseImage;
      return vuln;
    });
  }
  if (
    options.docker &&
    res.docker?.baseImage &&
    options['exclude-base-image-vulns']
  ) {
    const filteredVulns = res.vulnerabilities.filter(
      (vuln) => (vuln as DockerIssue).dockerfileInstruction,
    );
    // `exclude-base-image-vulns` might have left us with no vulns, so `ok` is now `true`
    if (
      res.vulnerabilities.length !== 0 &&
      filteredVulns.length === 0 &&
      !res.ok
    ) {
      res.ok = true;
    }
    res.vulnerabilities = filteredVulns;
  }

  res.uniqueCount = countUniqueVulns(res.vulnerabilities);

  return res;
}

function sendTestPayload(
  payload: Payload,
): Promise<
  LegacyVulnApiResult | TestDepGraphResponse | TestDependenciesResponse
> {
  const payloadBody = payload.body as any;
  const filesystemPolicy =
    payload.body && !!(payloadBody?.policy || payloadBody?.scanResult?.policy);
  return new Promise((resolve, reject) => {
    makeRequest(payload, (error, res, body) => {
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
      err.innerError = body.stack || body;
      break;
    case 404:
      err = new NotFoundError(userMessage);
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

  const ecosystem = getEcosystem(options);
  if (ecosystem) {
    return assembleEcosystemPayloads(ecosystem, options);
  }
  if (isLocal) {
    return assembleLocalPayloads(root, options);
  }
  return assembleRemotePayloads(root, options);
}

// Payload to send to the Registry for scanning a package from the local filesystem.
async function assembleLocalPayloads(
  root,
  options: Options & TestOptions & PolicyOptions,
): Promise<Payload[]> {
  // For --all-projects packageManager is yet undefined here. Use 'all'
  let analysisTypeText = 'all dependencies for ';
  if (options.docker) {
    analysisTypeText = 'docker dependencies for ';
  } else if (options.packageManager) {
    analysisTypeText = options.packageManager + ' dependencies for ';
  }

  const spinnerLbl =
    'Analyzing ' +
    analysisTypeText +
    (path.relative('.', path.join(root, options.file || '')) ||
      path.relative('..', '.') + ' project dir');

  try {
    const payloads: Payload[] = [];
    await spinner.clear<void>(spinnerLbl)();
    if (!options.quiet) {
      await spinner(spinnerLbl);
    }

    const deps = await getDepsFromPlugin(root, options);
    const failedResults = (deps as MultiProjectResultCustom).failedResults;
    if (failedResults?.length) {
      await spinner.clear<void>(spinnerLbl)();
      if (!options.json && !options.quiet) {
        console.warn(
          chalk.bold.red(
            `${icon.ISSUE} ${failedResults.length}/${failedResults.length +
              deps.scannedProjects
                .length} potential projects failed to get dependencies.`,
          ),
        );
        failedResults.forEach((f) => {
          if (f.targetFile) {
            console.warn(theme.color.status.error(`${f.targetFile}:`));
          }
          console.warn(theme.color.status.error(`  ${f.errMessage}`));
        });
      }
      debug(
        'getDepsFromPlugin returned failed results, cannot run test/monitor',
        failedResults,
      );
      if (options['fail-fast']) {
        throw new FailedToRunTestError(
          errorMessageWithRetry('Your test request could not be completed.'),
        );
      }
    }
    analytics.add('pluginName', deps.plugin.name);
    const javaVersion = get(
      deps.plugin,
      'meta.versionBuildInfo.metaBuildVersion.javaVersion',
      null,
    );
    const mvnVersion = get(
      deps.plugin,
      'meta.versionBuildInfo.metaBuildVersion.mvnVersion',
      null,
    );
    const sbtVersion = get(
      deps.plugin,
      'meta.versionBuildInfo.metaBuildVersion.sbtVersion',
      null,
    );
    if (javaVersion) {
      analytics.add('javaVersion', javaVersion);
    }
    if (mvnVersion) {
      analytics.add('mvnVersion', mvnVersion);
    }
    if (sbtVersion) {
      analytics.add('sbtVersion', sbtVersion);
    }

    for (const scannedProject of deps.scannedProjects) {
      if (!scannedProject.depTree && !scannedProject.depGraph) {
        debug(
          'scannedProject is missing depGraph or depTree, cannot run test/monitor',
        );
        throw new FailedToRunTestError(
          errorMessageWithRetry('Your test request could not be completed.'),
        );
      }

      // prefer dep-graph fallback on dep tree
      // TODO: clean up once dep-graphs only
      const pkg:
        | DepTree
        | depGraphLib.DepGraph
        | undefined = scannedProject.depGraph
        ? scannedProject.depGraph
        : scannedProject.depTree;

      if (options['print-deps']) {
        if (scannedProject.depGraph) {
          await spinner.clear<void>(spinnerLbl)();
          maybePrintDepGraph(options, pkg as depGraphLib.DepGraph);
        } else {
          await spinner.clear<void>(spinnerLbl)();
          maybePrintDepTree(options, pkg as DepTree);
        }
      }

      const project = scannedProject as ScannedProjectCustom;
      const packageManager = extractPackageManager(project, deps, options);

      if ((pkg as DepTree).docker) {
        const baseImageFromDockerfile = (pkg as DepTree).docker.baseImage;
        if (!baseImageFromDockerfile && options['base-image']) {
          (pkg as DepTree).docker.baseImage = options['base-image'];
        }

        if (baseImageFromDockerfile && deps.plugin && deps.plugin.imageLayers) {
          analytics.add('BaseImage', baseImageFromDockerfile);
          analytics.add('imageLayers', deps.plugin.imageLayers);
        }
      }

      // todo: normalize what target file gets used across plugins and functions
      const targetFile =
        scannedProject.targetFile || deps.plugin.targetFile || options.file;

      // Forcing options.path to be a string as pathUtil requires is to be stringified
      const targetFileRelativePath = targetFile
        ? pathUtil.resolve(
            pathUtil.resolve(`${options.path || root}`),
            targetFile,
          )
        : '';

      let targetFileDir;

      if (targetFileRelativePath) {
        const { dir } = path.parse(targetFileRelativePath);
        targetFileDir = dir;
      }

      const policy = await findAndLoadPolicy(
        root,
        options.docker ? 'docker' : packageManager!,
        options,
        // TODO: fix this and send only send when we used resolve-deps for node
        // it should be a ExpandedPkgTree type instead
        pkg,
        targetFileDir,
      );

      analytics.add('packageManager', packageManager);
      if (scannedProject.depGraph) {
        const depGraph = pkg as depGraphLib.DepGraph;
        addPackageAnalytics(depGraph.rootPkg.name, depGraph.rootPkg.version!);
      }
      if (scannedProject.depTree) {
        const depTree = pkg as DepTree;
        addPackageAnalytics(depTree.name!, depTree.version!);
      }

      let target: GitTarget | ContainerTarget | null;
      if (scannedProject.depGraph) {
        target = await projectMetadata.getInfo(scannedProject, options);
      } else {
        target = await projectMetadata.getInfo(
          scannedProject,
          options,
          pkg as DepTree,
        );
      }

      const originalProjectName = scannedProject.depGraph
        ? (pkg as depGraphLib.DepGraph).rootPkg.name
        : (pkg as DepTree).name;

      // print dep graph if `--print-graph` is set
      if (options['print-graph'] && !options['print-deps']) {
        await spinner.clear<void>(spinnerLbl)();
        let root: depGraphLib.DepGraph;
        if (scannedProject.depGraph) {
          root = pkg as depGraphLib.DepGraph;
        } else {
          const tempDepTree = pkg as DepTree;
          root = await depGraphLib.legacy.depTreeToGraph(
            tempDepTree,
            packageManager ? packageManager : '',
          );
        }

        console.log('DepGraph data:');
        console.log(jsonStringifyLargeObject(root.toJSON()));
        console.log('DepGraph target:\n' + targetFile + '\nDepGraph end');
      }

      const body: PayloadBody = {
        // WARNING: be careful changing this as it affects project uniqueness
        targetFile: project.plugin.targetFile,

        // TODO: Remove relativePath prop once we gather enough ruby related logs
        targetFileRelativePath: `${targetFileRelativePath}`, // Forcing string
        targetReference: options['target-reference'],
        projectNameOverride: options.projectName,
        originalProjectName,
        policy: policy ? policy.toString() : undefined,
        foundProjectCount: await getExtraProjectCount(root, options, deps),
        displayTargetFile: targetFile,
        docker: (pkg as DepTree).docker,
        hasDevDependencies: (pkg as any).hasDevDependencies,
        target,
      };

      let depGraph: depGraphLib.DepGraph;
      if (scannedProject.depGraph) {
        depGraph = scannedProject.depGraph;
      } else {
        // Graphs are more compact and robust representations.
        // Legacy parts of the code are still using trees, but will eventually be fully migrated.
        debug('converting dep-tree to dep-graph', {
          name: (pkg as DepTree).name,
          targetFile: scannedProject.targetFile || options.file,
        });
        depGraph = await depGraphLib.legacy.depTreeToGraph(
          pkg as DepTree,
          packageManager!,
        );
        debug('done converting dep-tree to dep-graph', {
          uniquePkgsCount: depGraph.getPkgs().length,
        });
      }

      const pruneIsRequired = options.pruneRepeatedSubdependencies;

      if (packageManager) {
        depGraph = await pruneGraph(depGraph, packageManager, pruneIsRequired);
      }
      body.depGraph = depGraph;

      const reqUrl =
        config.API +
        (options.testDepGraphDockerEndpoint ||
          options.vulnEndpoint ||
          '/test-dep-graph');
      const payload: Payload = {
        method: 'POST',
        url: reqUrl,
        json: true,
        headers: {
          'x-is-ci': isCI(),
          authorization: getAuthHeader(),
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
  addPackageAnalytics(pkg.name, pkg.version);
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
        authorization: getAuthHeader(),
      },
    },
  ];
}

function addPackageAnalytics(name: string, version: string): void {
  analytics.add('packageName', name);
  analytics.add('packageVersion', version);
  analytics.add('package', name + '@' + version);
}

function countUniqueVulns(vulns: AnnotatedIssue[]): number {
  const seen = {};
  for (const curr of vulns) {
    seen[curr.id] = true;
  }
  return Object.keys(seen).length;
}
