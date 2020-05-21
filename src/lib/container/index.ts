import { ScannedProject } from '@snyk/cli-interface/legacy/common';
import { MonitorMeta } from '../types';

export function isContainer(scannedProject: ScannedProject): boolean {
  return scannedProject.meta?.imageName?.length;
}

export function getContainerTargetFile(
  scannedProject: ScannedProject,
): string | undefined {
  return scannedProject.targetFile;
}

export function getContainerName(
  scannedProject: ScannedProject,
  meta: MonitorMeta,
): string | undefined {
  let name = scannedProject.meta?.imageName;
  if (meta['project-name']?.length) {
    name = meta['project-name'];
  }
  if (scannedProject.targetFile) {
    // for app+os projects the name of project is a mix of the image name
    // with the target file (if one exists)
    return name + ':' + scannedProject.targetFile;
  } else {
    return name;
  }
}

export function getContainerProjectName(
  scannedProject: ScannedProject,
  meta: MonitorMeta,
): string | undefined {
  let name = scannedProject.meta?.imageName;
  if (meta['project-name']?.length) {
    name = meta['project-name'];
  }
  return name;
}
