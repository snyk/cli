import * as Debug from 'debug';
import * as path from 'path';
import * as depGraphLib from '@snyk/dep-graph';
import * as snyk from '..';
import { apiOrOAuthTokenExists, getAuthHeader } from '../api-token';
import { makeRequest } from '../request';
import config from '../config';
import * as os from 'os';
const get = require('lodash.get');
import { isCI } from '../is-ci';
import * as analytics from '../analytics';
import {
  DepTree,
  MonitorMeta,
  MonitorResult,
  PolicyOptions,
  MonitorOptions,
  Options,
  Contributor,
  ProjectAttributes,
  Tag,
} from '../types';
import * as projectMetadata from '../project-metadata';
import {
  MonitorError,
  ConnectionTimeoutError,
  FailedToRunTestError,
  errorMessageWithRetry,
} from '../errors';
import { pruneGraph } from '../prune';
import { GRAPH_SUPPORTED_PACKAGE_MANAGERS } from '../package-managers';
import { countTotalDependenciesInTree } from './count-total-deps-in-tree';
import { filterOutMissingDeps } from './filter-out-missing-deps';
import { dropEmptyDeps } from './drop-empty-deps';
import { pruneTree } from './prune-dep-tree';
import { findAndLoadPolicy } from '../policy';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import {
  CallGraph,
  CallGraphError,
  ScannedProject,
} from '@snyk/cli-interface/legacy/common';
import { isGitTarget } from '../project-metadata/types';
import { serializeCallGraphWithMetrics } from '../reachable-vulns';
import {
  getNameDepTree,
  getNameDepGraph,
  getProjectName,
  getTargetFile,
} from './utils';
import { countPathsToGraphRoot } from '../utils';
import * as alerts from '../alerts';
import { abridgeErrorMessage } from '../error-format';

const debug = Debug('snyk');

const ANALYTICS_PAYLOAD_MAX_LENGTH = 1024;

interface MonitorBody {
  meta: Meta;
  policy: string;
  package?: DepTree;
  callGraph?: CallGraph;
  target: {};
  targetFileRelativePath: string;
  targetFile: string;
  contributors?: Contributor[];
}

interface Meta {
  method?: string;
  hostname: string;
  id: string;
  ci: boolean;
  pid: number;
  node: string;
  master: boolean;
  name: string;
  version: string;
  org?: string;
  pluginName: string;
  pluginRuntime: string;
  dockerImageId?: string;
  dockerBaseImage?: string;
  projectName: string;
}

export async function monitor(
  root: string,
  meta: MonitorMeta,
  scannedProject: ScannedProject,
  options: Options & MonitorOptions & PolicyOptions,
  pluginMeta: PluginMetadata,
  targetFileRelativePath?: string,
  contributors?: Contributor[],
  projectAttributes?: ProjectAttributes,
  tags?: Tag[],
): Promise<MonitorResult> {
  apiOrOAuthTokenExists();

  const packageManager = meta.packageManager;
  analytics.add('packageManager', packageManager);
  analytics.add('isDocker', !!meta.isDocker);

  if (scannedProject.depGraph) {
    return await monitorDepGraph(
      root,
      meta,
      scannedProject,
      pluginMeta,
      options,
      targetFileRelativePath,
      contributors,
      projectAttributes,
      tags,
    );
  }

  if (GRAPH_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)) {
    return await monitorDepGraphFromDepTree(
      root,
      meta,
      scannedProject,
      pluginMeta,
      options,
      targetFileRelativePath,
      contributors,
      projectAttributes,
      tags,
    );
  }

  return await monitorDepTree(
    root,
    meta,
    scannedProject,
    pluginMeta,
    options,
    targetFileRelativePath,
    contributors,
    projectAttributes,
    tags,
  );
}

async function monitorDepTree(
  root: string,
  meta: MonitorMeta,
  scannedProject: ScannedProject,
  pluginMeta: PluginMetadata,
  options: MonitorOptions & PolicyOptions,
  targetFileRelativePath?: string,
  contributors?: Contributor[],
  projectAttributes?: ProjectAttributes,
  tags?: Tag[],
): Promise<MonitorResult> {
  let treeMissingDeps: string[] = [];

  const packageManager = meta.packageManager;

  let depTree = scannedProject.depTree;

  if (!depTree) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      errorMessageWithRetry('Your monitor request could not be completed.'),
    );
  }

  let prePruneDepCount;
  if (meta.prune) {
    debug('prune used, counting total dependencies');
    prePruneDepCount = countTotalDependenciesInTree(depTree);
    analytics.add('prePruneDepCount', prePruneDepCount);
    debug('total dependencies: %d', prePruneDepCount);
    debug('pruning dep tree');
    depTree = await pruneTree(depTree, meta.packageManager);
    debug('finished pruning dep tree');
  }
  if (['npm', 'yarn'].includes(meta.packageManager)) {
    const { filteredDepTree, missingDeps } = filterOutMissingDeps(depTree);
    depTree = filteredDepTree;
    treeMissingDeps = missingDeps;
  }

  let targetFileDir;

  if (targetFileRelativePath) {
    const { dir } = path.parse(targetFileRelativePath);
    targetFileDir = dir;
  }

  const policy = await findAndLoadPolicy(
    root,
    meta.isDocker ? 'docker' : packageManager!,
    options,
    depTree,
    targetFileDir,
  );

  const target = await projectMetadata.getInfo(scannedProject, meta, depTree);

  if (isGitTarget(target) && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  depTree = dropEmptyDeps(depTree);

  let callGraphPayload;
  if (
    options.reachableVulns &&
    (scannedProject.callGraph as CallGraphError)?.innerError
  ) {
    const err = scannedProject.callGraph as CallGraphError;
    analytics.add(
      'callGraphError',
      abridgeErrorMessage(
        err.innerError.toString(),
        ANALYTICS_PAYLOAD_MAX_LENGTH,
      ),
    );
    alerts.registerAlerts([
      {
        type: 'error',
        name: 'missing-call-graph',
        msg: err.message,
      },
    ]);
  } else if (scannedProject.callGraph) {
    const { callGraph, nodeCount, edgeCount } = serializeCallGraphWithMetrics(
      scannedProject.callGraph as CallGraph,
    );
    debug(
      `Adding call graph to payload, node count: ${nodeCount}, edge count: ${edgeCount}`,
    );

    const callGraphMetrics = get(pluginMeta, 'meta.callGraphMetrics', {});
    analytics.add('callGraphMetrics', {
      callGraphEdgeCount: edgeCount,
      callGraphNodeCount: nodeCount,
      ...callGraphMetrics,
    });
    callGraphPayload = callGraph;
  }

  if (!depTree) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      errorMessageWithRetry('Your monitor request could not be completed.'),
    );
  }

  const { res, body } = await makeRequest({
    body: {
      meta: {
        method: meta.method,
        hostname: os.hostname(),
        id: snyk.id || depTree.name,
        ci: isCI(),
        pid: process.pid,
        node: process.version,
        master: snyk.config.isMaster,
        name: getNameDepTree(scannedProject, depTree, meta),
        version: depTree.version,
        org: config.org ? decodeURIComponent(config.org) : undefined,
        pluginName: pluginMeta.name,
        pluginRuntime: pluginMeta.runtime,
        missingDeps: treeMissingDeps,
        dockerImageId: pluginMeta.dockerImageId,
        dockerBaseImage: depTree.docker ? depTree.docker.baseImage : undefined,
        dockerfileLayers: depTree.docker
          ? depTree.docker.dockerfileLayers
          : undefined,
        projectName: getProjectName(scannedProject, meta),
        prePruneDepCount, // undefined unless 'prune' is used,
        monitorGraph: false,
        versionBuildInfo: JSON.stringify(scannedProject.meta?.versionBuildInfo),
        gradleProjectName: scannedProject.meta?.gradleProjectName,
        platform: scannedProject.meta?.platform,
      },
      policy: policy ? policy.toString() : undefined,
      package: depTree,
      callGraph: callGraphPayload,
      // we take the targetFile from the plugin,
      // because we want to send it only for specific package-managers
      target,
      // WARNING: be careful changing this as it affects project uniqueness
      targetFile: getTargetFile(scannedProject, pluginMeta),
      targetFileRelativePath,
      targetReference: meta.targetReference,
      contributors,
      projectAttributes,
      tags,
    } as MonitorBody,
    gzip: true,
    method: 'PUT',
    headers: {
      authorization: getAuthHeader(),
      'content-encoding': 'gzip',
    },
    url: config.API + '/monitor/' + packageManager,
    json: true,
  });

  if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
    return body as MonitorResult;
  } else {
    const userMessage = body && body.userMessage;
    if (!userMessage && res.statusCode === 504) {
      throw new ConnectionTimeoutError();
    } else {
      throw new MonitorError(res.statusCode, userMessage);
    }
  }
}

export async function monitorDepGraph(
  root: string,
  meta: MonitorMeta,
  scannedProject: ScannedProject,
  pluginMeta: PluginMetadata,
  options: MonitorOptions & PolicyOptions,
  targetFileRelativePath?: string,
  contributors?: Contributor[],
  projectAttributes?: ProjectAttributes,
  tags?: Tag[],
): Promise<MonitorResult> {
  const packageManager = meta.packageManager;
  analytics.add('monitorDepGraph', true);

  let depGraph = scannedProject.depGraph;

  if (!depGraph) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      'Your monitor request could not be completed. ',
    );
  }

  let targetFileDir;

  if (targetFileRelativePath) {
    const { dir } = path.parse(targetFileRelativePath);
    targetFileDir = dir;
  }

  const policy = await findAndLoadPolicy(
    root,
    meta.isDocker ? 'docker' : packageManager!,
    options,
    undefined,
    targetFileDir,
  );

  const target = await projectMetadata.getInfo(scannedProject, meta);
  if (isGitTarget(target) && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  const pruneIsRequired = options.pruneRepeatedSubdependencies;
  depGraph = await pruneGraph(depGraph, packageManager, pruneIsRequired);

  let callGraphPayload;
  if (
    options.reachableVulns &&
    (scannedProject.callGraph as CallGraphError)?.innerError
  ) {
    const err = scannedProject.callGraph as CallGraphError;
    analytics.add(
      'callGraphError',
      abridgeErrorMessage(
        err.innerError.toString(),
        ANALYTICS_PAYLOAD_MAX_LENGTH,
      ),
    );
    alerts.registerAlerts([
      {
        type: 'error',
        name: 'missing-call-graph',
        msg: err.message,
      },
    ]);
  } else if (scannedProject.callGraph) {
    const { callGraph, nodeCount, edgeCount } = serializeCallGraphWithMetrics(
      scannedProject.callGraph as CallGraph,
    );
    debug(
      `Adding call graph to payload, node count: ${nodeCount}, edge count: ${edgeCount}`,
    );

    const callGraphMetrics = get(pluginMeta, 'meta.callGraphMetrics', {});
    analytics.add('callGraphMetrics', {
      callGraphEdgeCount: edgeCount,
      callGraphNodeCount: nodeCount,
      ...callGraphMetrics,
    });
    callGraphPayload = callGraph;
  }

  if (!depGraph) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      errorMessageWithRetry('Your monitor request could not be completed.'),
    );
  }

  const { res, body } = await makeRequest({
    body: {
      meta: {
        method: meta.method,
        hostname: os.hostname(),
        id: snyk.id || depGraph.rootPkg.name,
        ci: isCI(),
        pid: process.pid,
        node: process.version,
        master: snyk.config.isMaster,
        name: getNameDepGraph(scannedProject, depGraph, meta),
        version: depGraph.rootPkg.version,
        org: config.org ? decodeURIComponent(config.org) : undefined,
        pluginName: pluginMeta.name,
        pluginRuntime: pluginMeta.runtime,
        projectName: getProjectName(scannedProject, meta),
        monitorGraph: true,
        versionBuildInfo: JSON.stringify(scannedProject.meta?.versionBuildInfo),
        gradleProjectName: scannedProject.meta?.gradleProjectName,
      },
      policy: policy ? policy.toString() : undefined,
      depGraphJSON: depGraph, // depGraph will be auto serialized to JSON on send
      // we take the targetFile from the plugin,
      // because we want to send it only for specific package-managers
      target,
      targetFile: getTargetFile(scannedProject, pluginMeta),
      targetFileRelativePath,
      targetReference: meta.targetReference,
      contributors,
      callGraph: callGraphPayload,
      projectAttributes,
      tags,
    } as MonitorBody,
    gzip: true,
    method: 'PUT',
    headers: {
      authorization: getAuthHeader(),
      'content-encoding': 'gzip',
    },
    url: `${config.API}/monitor/${packageManager}/graph`,
    json: true,
  });

  if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
    return body as MonitorResult;
  } else {
    const userMessage = body && body.userMessage;
    if (!userMessage && res.statusCode === 504) {
      throw new ConnectionTimeoutError();
    } else {
      throw new MonitorError(res.statusCode, userMessage);
    }
  }
}

async function monitorDepGraphFromDepTree(
  root: string,
  meta: MonitorMeta,
  scannedProject: ScannedProject,
  pluginMeta: PluginMetadata,
  options: MonitorOptions & PolicyOptions,
  targetFileRelativePath?: string,
  contributors?: Contributor[],
  projectAttributes?: ProjectAttributes,
  tags?: Tag[],
): Promise<MonitorResult> {
  const packageManager = meta.packageManager;

  let treeMissingDeps: string[] | undefined;
  let depTree = scannedProject.depTree;

  if (!depTree) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      errorMessageWithRetry('Your monitor request could not be completed'),
    );
  }

  let targetFileDir;

  if (targetFileRelativePath) {
    const { dir } = path.parse(targetFileRelativePath);
    targetFileDir = dir;
  }

  const policy = await findAndLoadPolicy(
    root,
    meta.isDocker ? 'docker' : packageManager!,
    options,
    // TODO: fix this and send only send when we used resolve-deps for node
    // it should be a ExpandedPkgTree type instead
    depTree,
    targetFileDir,
  );

  if (['npm', 'yarn'].includes(meta.packageManager)) {
    const { filteredDepTree, missingDeps } = filterOutMissingDeps(depTree);
    depTree = filteredDepTree;
    treeMissingDeps = missingDeps;
  }

  const depGraph: depGraphLib.DepGraph =
    await depGraphLib.legacy.depTreeToGraph(depTree, packageManager);
  const target = await projectMetadata.getInfo(scannedProject, meta, depTree);

  if (isGitTarget(target) && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  let prunedGraph = depGraph;
  let prePruneDepCount;
  if (meta.prune) {
    debug('Trying to prune the graph');
    prePruneDepCount = countPathsToGraphRoot(depGraph);
    debug('pre prunedPathsCount: ' + prePruneDepCount);
    prunedGraph = await pruneGraph(depGraph, packageManager, meta.prune);
  }

  if (!depTree) {
    debug(
      'scannedProject is missing depGraph or depTree, cannot run test/monitor',
    );
    throw new FailedToRunTestError(
      errorMessageWithRetry('Your monitor request could not be completed.'),
    );
  }
  const { res, body } = await makeRequest({
    body: {
      meta: {
        method: meta.method,
        hostname: os.hostname(),
        id: snyk.id || depTree.name,
        ci: isCI(),
        pid: process.pid,
        node: process.version,
        master: snyk.config.isMaster,
        name: getNameDepGraph(scannedProject, depGraph, meta),
        version: depGraph.rootPkg.version,
        org: config.org ? decodeURIComponent(config.org) : undefined,
        pluginName: pluginMeta.name,
        pluginRuntime: pluginMeta.runtime,
        dockerImageId: pluginMeta.dockerImageId,
        dockerBaseImage: depTree.docker ? depTree.docker.baseImage : undefined,
        dockerfileLayers: depTree.docker
          ? depTree.docker.dockerfileLayers
          : undefined,
        projectName: getProjectName(scannedProject, meta),
        prePruneDepCount, // undefined unless 'prune' is used
        missingDeps: treeMissingDeps,
        monitorGraph: true,
      },
      policy: policy ? policy.toString() : undefined,
      depGraphJSON: prunedGraph, // depGraph will be auto serialized to JSON on send
      // we take the targetFile from the plugin,
      // because we want to send it only for specific package-managers
      target,
      targetFile: getTargetFile(scannedProject, pluginMeta),
      targetFileRelativePath,
      targetReference: meta.targetReference,
      contributors,
      projectAttributes,
      tags,
    } as MonitorBody,
    gzip: true,
    method: 'PUT',
    headers: {
      authorization: getAuthHeader(),
      'content-encoding': 'gzip',
    },
    url: `${config.API}/monitor/${packageManager}/graph`,
    json: true,
  });

  if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
    return body as MonitorResult;
  } else {
    const userMessage = body && body.userMessage;
    if (!userMessage && res.statusCode === 504) {
      throw new ConnectionTimeoutError();
    } else {
      throw new MonitorError(res.statusCode, userMessage);
    }
  }
}
