import * as Debug from 'debug';
import * as depGraphLib from '@snyk/dep-graph';
import * as cliInterface from '@snyk/cli-interface';
import * as snyk from '..';
import { apiTokenExists } from '../api-token';
import request = require('../request');
import * as config from '../config';
import * as os from 'os';
import * as _ from 'lodash';
import { isCI } from '../is-ci';
import * as analytics from '../analytics';
import { DepTree, MonitorMeta, MonitorResult, PluginMetadata } from '../types';
import * as projectMetadata from '../project-metadata';
import * as path from 'path';
import {
  MonitorError,
  ConnectionTimeoutError,
  AuthFailedError,
} from '../errors';
import { countPathsToGraphRoot, pruneGraph } from '../prune';
import { GRAPH_SUPPORTED_PACKAGE_MANAGERS } from '../package-managers';
import { isFeatureFlagSupportedForOrg } from '../feature-flags';
import { countTotalDependenciesInTree } from './count-total-deps-in-tree';
import { filterOutMissingDeps } from './filter-out-missing-deps';
import { dropEmptyDeps } from './drop-empty-deps';
import { pruneTree } from './prune-dep-tree';
import { pluckPolicies } from '../policy';

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

export async function monitor(
  root: string,
  meta: MonitorMeta,
  scannedProject: cliInterface.legacyCommon.ScannedProject,
  options,
  pluginMeta: PluginMetadata,
  targetFileRelativePath?: string,
): Promise<MonitorResult> {
  apiTokenExists();
  let treeMissingDeps: string[] = [];

  const packageManager = meta.packageManager;
  analytics.add('packageManager', packageManager);
  analytics.add('isDocker', !!meta.isDocker);
  analytics.add('monitorGraph', true);

  if (GRAPH_SUPPORTED_PACKAGE_MANAGERS.includes(packageManager)) {
    const monitorGraphSupportedRes = await isFeatureFlagSupportedForOrg(
      _.camelCase('experimental-dep-graph'),
      options.org || config.org,
    );

    if (monitorGraphSupportedRes.code === 401) {
      throw AuthFailedError(
        monitorGraphSupportedRes.error,
        monitorGraphSupportedRes.code,
      );
    }
    if (monitorGraphSupportedRes.ok) {
      return await monitorGraph(
        root,
        meta,
        scannedProject,
        pluginMeta,
        targetFileRelativePath,
      );
    }
    if (monitorGraphSupportedRes.userMessage) {
      debug(monitorGraphSupportedRes.userMessage);
    }
  }

  let pkg = scannedProject.depTree;

  let prePruneDepCount;
  if (meta.prune) {
    debug('prune used, counting total dependencies');
    prePruneDepCount = countTotalDependenciesInTree(scannedProject.depTree);
    analytics.add('prePruneDepCount', prePruneDepCount);
    debug('total dependencies: %d', prePruneDepCount);
    debug('pruning dep tree');
    pkg = await pruneTree(scannedProject.depTree, meta.packageManager);
    debug('finished pruning dep tree');
  }
  if (['npm', 'yarn'].includes(meta.packageManager)) {
    const { filteredDepTree, missingDeps } = filterOutMissingDeps(
      scannedProject.depTree,
    );
    pkg = filteredDepTree;
    treeMissingDeps = missingDeps;
  }

  const policyPath = meta['policy-path'] || root;
  const policyLocations = [policyPath]
    .concat(pluckPolicies(pkg))
    .filter(Boolean);
  // docker doesn't have a policy as it can be run from anywhere
  if (!meta.isDocker || !policyLocations.length) {
    await snyk.policy.create();
  }
  const policy = await snyk.policy.load(policyLocations, { loose: true });

  const target = await projectMetadata.getInfo(pkg, meta);

  if (target && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  pkg = dropEmptyDeps(pkg);

  // TODO(kyegupov): async/await
  return new Promise((resolve, reject) => {
    request(
      {
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
            missingDeps: treeMissingDeps,
            dockerImageId: pluginMeta.dockerImageId,
            dockerBaseImage: pkg.docker ? pkg.docker.baseImage : undefined,
            dockerfileLayers: pkg.docker
              ? pkg.docker.dockerfileLayers
              : undefined,
            projectName: meta['project-name'],
            prePruneDepCount, // undefined unless 'prune' is used,
            monitorGraph: false,
          },
          policy: policy ? policy.toString() : undefined,
          package: pkg,
          // we take the targetFile from the plugin,
          // because we want to send it only for specific package-managers
          target,
          // WARNING: be careful changing this as it affects project uniqueness
          targetFile: pluginMeta.targetFile,
          targetFileRelativePath,
        } as MonitorBody,
        gzip: true,
        method: 'PUT',
        headers: {
          authorization: 'token ' + snyk.api,
          'content-encoding': 'gzip',
        },
        url: config.API + '/monitor/' + packageManager,
        json: true,
      },
      (error, res, body) => {
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
      },
    );
  });
}

export async function monitorGraph(
  root: string,
  meta: MonitorMeta,
  scannedProject: cliInterface.legacyCommon.ScannedProject,
  pluginMeta: PluginMetadata,
  targetFileRelativePath?: string,
): Promise<MonitorResult> {
  const packageManager = meta.packageManager;
  analytics.add('monitorGraph', true);

  let treeMissingDeps: string[];
  let pkg = scannedProject.depTree;
  const policyPath = meta['policy-path'] || root;
  const policyLocations = [policyPath]
    .concat(pluckPolicies(pkg))
    .filter(Boolean);

  if (['npm', 'yarn'].includes(meta.packageManager)) {
    const { filteredDepTree, missingDeps } = filterOutMissingDeps(pkg);
    pkg = filteredDepTree;
    treeMissingDeps = missingDeps;
  }

  const depGraph: depGraphLib.DepGraph = await depGraphLib.legacy.depTreeToGraph(
    pkg,
    packageManager,
  );

  // docker doesn't have a policy as it can be run from anywhere
  if (!meta.isDocker || !policyLocations.length) {
    await snyk.policy.create();
  }
  const policy = await snyk.policy.load(policyLocations, { loose: true });

  const target = await projectMetadata.getInfo(pkg, meta);

  if (target && target.branch) {
    analytics.add('targetBranch', target.branch);
  }

  let prunedGraph = depGraph;
  let prePruneDepCount;
  if (meta.prune) {
    debug('Trying to prune the graph');
    prePruneDepCount = countPathsToGraphRoot(depGraph);
    debug('pre prunedPathsCount: ' + prePruneDepCount);
    prunedGraph = await pruneGraph(depGraph, packageManager);
  }

  return new Promise((resolve, reject) => {
    request(
      {
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
            dockerfileLayers: pkg.docker
              ? pkg.docker.dockerfileLayers
              : undefined,
            projectName: meta['project-name'],
            prePruneDepCount, // undefined unless 'prune' is used
            missingDeps: treeMissingDeps,
            monitorGraph: true,
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
          authorization: 'token ' + snyk.api,
          'content-encoding': 'gzip',
        },
        url: `${config.API}/monitor/${packageManager}/graph`,
        json: true,
      },
      (error, res, body) => {
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
      },
    );
  });
}
