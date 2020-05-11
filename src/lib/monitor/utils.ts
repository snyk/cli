import { ScannedProject, DepTree } from '@snyk/cli-interface/legacy/common';
import {
  getContainerTargetFile,
  getContainerProjectName,
  getContainerName,
  isContainer,
} from '../container';
import * as depGraphLib from '@snyk/dep-graph';
import { MonitorMeta } from '../types';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

export function getNameDepTree(
  scannedProject: ScannedProject,
  depTree: DepTree,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerName(scannedProject);
  }
  return depTree.name;
}

export function getNameDepGraph(
  scannedProject: ScannedProject,
  depGraph: depGraphLib.DepGraph,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerName(scannedProject);
  }
  return depGraph.rootPkg?.name;
}

export function getProjectName(
  scannedProject: ScannedProject,
  meta: MonitorMeta,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerProjectName(scannedProject);
  }
  return meta['project-name'];
}

export function getTargetFile(
  scannedProject: ScannedProject,
  pluginMeta: PluginMetadata,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerTargetFile(scannedProject);
  }
  return pluginMeta.targetFile;
}
