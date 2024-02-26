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
  meta: MonitorMeta,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerName(scannedProject, meta);
  }
  return depTree.name;
}

export function getNameDepGraph(
  scannedProject: ScannedProject,
  depGraph: depGraphLib.DepGraph,
  meta: MonitorMeta,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerName(scannedProject, meta);
  }
  return depGraph.rootPkg?.name;
}

export function getProjectName(
  scannedProject: ScannedProject,
  meta: MonitorMeta,
): string | undefined {
  if (isContainer(scannedProject)) {
    return getContainerProjectName(scannedProject, meta);
  }

  if (meta['project-name'] && scannedProject.meta?.projectName) {
    return scannedProject.meta.projectName;
  }

  if (scannedProject.meta?.gradleProjectName && !meta['project-name']) {
    return scannedProject.meta.gradleProjectName;
  }

  if (meta.assetsProjectName && !meta['project-name']) {
    return scannedProject.depTree?.name;
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
