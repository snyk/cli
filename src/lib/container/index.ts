import { ScannedProject } from '@snyk/cli-interface/legacy/common';

export function isContainer(scannedProject: ScannedProject): boolean {
  return scannedProject.meta?.imageName !== undefined;
}

export function getContainerTargetFile(
  scannedProject: ScannedProject,
): string | undefined {
  return scannedProject.targetFile;
}

export function getContainerName(
  scannedProject: ScannedProject,
): string | undefined {
  if (scannedProject.targetFile) {
    // for app+os projects the name of project is a mix of the image name
    // with the target file (if one exists)
    return scannedProject.meta?.imageName + ':' + scannedProject.targetFile;
  } else {
    return scannedProject.meta?.imageName;
  }
}

export function getContainerProjectName(
  scannedProject: ScannedProject,
): string | undefined {
  return scannedProject.meta?.imageName;
}
