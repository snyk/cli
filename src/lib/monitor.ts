import * as Debug from 'debug';
import * as depGraphLib from '@snyk/dep-graph';
import * as snyk from '../lib';
import {apiTokenExists} from './api-token';
import * as request from './request';
import * as config from './config';
import * as os from 'os';
import * as _ from 'lodash';
import {isCI} from './is-ci';
import * as analytics from './analytics';
import { SingleDepRootResult, DepTree, MonitorMeta, MonitorResult } from './types';
import * as projectMetadata from './project-metadata';
import * as path from 'path';
import {MonitorError, ConnectionTimeoutError} from './errors';
import { SupportedPackageManagers, GRAPH_SUPPORTED_PACKAGE_MANAGERS } from './package-managers';

const debug = Debug('snyk');

// TODO(kyegupov): clean up the type, move to snyk-cli-interface repository

interface MonitorBody {
  meta: Meta;
  policy: string;
  package?: DepTree;
  depGraph?: depGraphLib.DepGraph;
  target: {};
  targetFileRelativePath: string;
  targetFile: string;
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

interface FilteredDepTree {
  filteredDepTree: DepTree;
  missingDeps: string[];
}

function dropEmptyDeps(node: DepTree) {
  if (node.dependencies) {
    const keys = Object.keys(node.dependencies);
    if (keys.length === 0) {
      delete node.dependencies;
    } else {
      for (const k of keys) {
        dropEmptyDeps(node.dependencies[k]);
      }
    }
  }
}

function countTotalDependenciesInTree(depTree: DepTree): number {
  let count = 0;
  if (depTree.dependencies) {
    for (const name of Object.keys(depTree.dependencies)) {
      const dep = depTree.dependencies[name];
      if (dep) {
        count += 1 + countTotalDependenciesInTree(dep);
      }
    }
  }
  return count;
}

async function pruneTree(tree: DepTree, packageManagerName: string): Promise<DepTree> {
  debug('pruning dep tree');
  // Pruning requires conversion to the graph first.
  // This is slow.
  const graph = await depGraphLib.legacy.depTreeToGraph(tree, packageManagerName);
  const prunedTree: DepTree = await depGraphLib.legacy
    .graphToDepTree(graph, packageManagerName, {deduplicateWithinTopLevelDeps: true}) as DepTree;
  // Transplant pruned dependencies in the original tree (we want to keep all other fields):
  tree.dependencies = prunedTree.dependencies;
  debug('finished pruning dep tree');
  return tree;
}

function filterOutMissingDeps(depTree: DepTree): FilteredDepTree {
  const filteredDeps = {};
  const missingDeps: string[] = [];

  if (!depTree.dependencies) {
    return {
      filteredDepTree: depTree,
      missingDeps,
    };
  }

  for (const depKey of Object.keys(depTree.dependencies)) {
    const dep = depTree.dependencies[depKey];
    if (dep.missingLockFileEntry) {
      missingDeps.push(`${dep.name}@${dep.version}`);
    } else {
      filteredDeps[depKey] = dep;
    }
  }
  const filteredDepTree: DepTree = {
    ...depTree,
    dependencies: filteredDeps,
  };

  return {
    filteredDepTree,
    missingDeps,
  };
}

export async function monitor(
    root: string,
    meta: MonitorMeta,
    info: SingleDepRootResult,
    targetFile?: string,
    ): Promise<MonitorResult> {
  apiTokenExists();

  const packageManager = meta.packageManager;
  analytics.add('packageManager', packageManager);
  analytics.add('isDocker', !!meta.isDocker);

  if (meta['experimental-dep-graph'] && GRAPH_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)) {
    return await monitorGraph(root, meta, info, targetFile);
  }

  let pkg = info.package;

  let prePruneDepCount;
  if (meta.prune) {
    debug('prune used, counting total dependencies');
    prePruneDepCount = countTotalDependenciesInTree(info.package);
    analytics.add('prePruneDepCount', prePruneDepCount);
    debug('total dependencies: %d', prePruneDepCount);
    pkg = await pruneTree(info.package, meta.packageManager);
  }

  const pluginMeta = info.plugin;
  let policy;
  const policyPath = meta['policy-path'] || root;
  const policyLocations = [policyPath].concat(pluckPolicies(pkg))
      .filter(Boolean);
  // docker doesn't have a policy as it can be run from anywhere
  if (!meta.isDocker || !policyLocations.length) {
    await snyk.policy.create();
  }
  policy = await snyk.policy.load(policyLocations, {loose: true});

  const target = await projectMetadata.getInfo(pkg);
  const targetFileRelativePath = targetFile ? path.relative(root, targetFile) : '';

  if (target && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  dropEmptyDeps(pkg);

  // TODO(kyegupov): async/await
  return new Promise((resolve, reject) => {
    request({
      body: {
        meta: {
          method: meta.method,
          hostname: os.hostname(),
          id: snyk.id || pkg.name,
          ci: isCI(),
          pid: process.pid,
          node: process.version,
          master: snyk.config.isMaster,
          name: pkg.name,
          version: pkg.version,
          org: config.org ? decodeURIComponent(config.org) : undefined,
          pluginName: pluginMeta.name,
          pluginRuntime: pluginMeta.runtime,
          dockerImageId: pluginMeta.dockerImageId,
          dockerBaseImage: pkg.docker ? pkg.docker.baseImage : undefined,
          dockerfileLayers: pkg.docker ? pkg.docker.dockerfileLayers : undefined,
          projectName: meta['project-name'],
          prePruneDepCount, // undefined unless 'prune' is used
        },
        policy: policy ? policy.toString() : undefined,
        package: pkg,
        // we take the targetFile from the plugin,
        // because we want to send it only for specific package-managers
        target,
        targetFile: pluginMeta.targetFile,
        targetFileRelativePath,
      } as MonitorBody,
      gzip: true,
      method: 'PUT',
      headers: {
        'authorization': 'token ' + snyk.api,
        'content-encoding': 'gzip',
      },
      url: config.API + '/monitor/' + packageManager,
      json: true,
    }, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      if (res.statusCode >= 200 && res.statusCode <= 299) {
        resolve(body as MonitorResult);
      } else {
        let err;
        const userMessage = body && body.userMessage;
        if (!userMessage && res.statusCode === 504) {
          err = new ConnectionTimeoutError();
        } else {
          err = new MonitorError(res.statusCode, userMessage);
        }
        reject(err);
      }
    });
  });
}

export async function monitorGraph(
    root: string,
    meta: MonitorMeta,
    info: SingleDepRootResult,
    targetFile?: string,
): Promise<MonitorResult> {
  const packageManager = meta.packageManager;

  let policy;
  let treeMissingDeps: string[];
  let pkg = info.package;
  const pluginMeta = info.plugin;
  const policyPath = meta['policy-path'] || root;
  const policyLocations = [policyPath].concat(pluckPolicies(pkg)).filter(Boolean);

  if (['npm', 'yarn'].includes(meta.packageManager)) {
    const { filteredDepTree, missingDeps } = filterOutMissingDeps(info.package);
    pkg = filteredDepTree;
    treeMissingDeps = missingDeps;
  }

  const depGraph: depGraphLib.DepGraph = await depGraphLib.legacy.depTreeToGraph(pkg, packageManager);

  // docker doesn't have a policy as it can be run from anywhere
  if (!meta.isDocker || !policyLocations.length) {
    await snyk.policy.create();
  }
  policy = await snyk.policy.load(policyLocations, {loose: true});

  const target = await projectMetadata.getInfo(pkg);
  const targetFileRelativePath = targetFile ? path.relative(root, targetFile) : '';

  if (target && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  let prunedGraph = depGraph;
  let prePruneDepCount;
  if (meta.prune) {
    debug('Trying to prune the graph');
    prePruneDepCount = countPathsToGraphRoot(depGraph);
    debug('pre prunedPathsCount: ' +  prePruneDepCount);
    prunedGraph = await pruneGraph(depGraph, packageManager);
  }

  return new Promise((resolve, reject) => {
    request({
      body: {
        meta: {
          method: meta.method,
          hostname: os.hostname(),
          id: snyk.id || pkg.name,
          ci: isCI(),
          pid: process.pid,
          node: process.version,
          master: snyk.config.isMaster,
          name: depGraph.rootPkg.name,
          version: depGraph.rootPkg.version,
          org: config.org ? decodeURIComponent(config.org) : undefined,
          pluginName: pluginMeta.name,
          pluginRuntime: pluginMeta.runtime,
          dockerImageId: pluginMeta.dockerImageId,
          dockerBaseImage: pkg.docker ? pkg.docker.baseImage : undefined,
          dockerfileLayers: pkg.docker ? pkg.docker.dockerfileLayers : undefined,
          projectName: meta['project-name'],
          prePruneDepCount, // undefined unless 'prune' is used
          missingDeps: treeMissingDeps,
        },
        policy: policy ? policy.toString() : undefined,
        depGraphJSON: prunedGraph, // depGraph will be auto serialized to JSON on send
        // we take the targetFile from the plugin,
        // because we want to send it only for specific package-managers
        target,
        targetFile: pluginMeta.targetFile,
        targetFileRelativePath,
      } as MonitorBody,
      gzip: true,
      method: 'PUT',
      headers: {
        'authorization': 'token ' + snyk.api,
        'content-encoding': 'gzip',
      },
      url: `${config.API}/monitor/${packageManager}/graph`,
      json: true,
    }, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      if (res.statusCode >= 200 && res.statusCode <= 299) {
        resolve(body as MonitorResult);
      } else {
        let err;
        const userMessage = body && body.userMessage;
        if (!userMessage && res.statusCode === 504) {
          err = new ConnectionTimeoutError();
        } else {
          err = new MonitorError(res.statusCode, userMessage);
        }
        reject(err);
      }
    });
  });
}

export function countPathsToGraphRoot(graph: depGraphLib.DepGraph): number {
  return graph
    .getPkgs()
    .map((pkg) => graph.countPathsToRoot(pkg))
    .reduce((acc, pathsToRoot) => acc + pathsToRoot, 0);
}

export async function pruneGraph(
    depGraph: depGraphLib.DepGraph,
    packageManager: SupportedPackageManagers,
  ): Promise<depGraphLib.DepGraph> {
    try {
    const threshold = config.PRUNE_DEPS_THRESHOLD; // Arbitrary threshold for maximum number of elements in the tree
    const prunedTree: DepTree = (await depGraphLib.legacy.graphToDepTree(
      depGraph,
      packageManager,
      { deduplicateWithinTopLevelDeps: true },
    )) as DepTree;

    const prunedGraph = await depGraphLib.legacy.depTreeToGraph(
      prunedTree,
      packageManager,
    );
    const count = countPathsToGraphRoot(prunedGraph);
    debug('prunedPathsCount: ' +  count);

    if (count < threshold) {
      return prunedGraph;
    }
    debug('Too many vulnerable paths to monitor the project');
    // TODO: create a custom error for this
    throw new Error('Too many vulnerable paths to monitor the project');
  } catch (e) {
    debug('Failed to prune the graph, returning original:' + e);
    return depGraph;
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
