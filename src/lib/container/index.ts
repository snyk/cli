import { ScannedProject } from '@snyk/cli-interface/legacy/common';
import { MonitorMeta } from '../types';
import { config as userConfig } from '../user-config';

export const IMAGE_SAVE_PATH_OPT = 'imageSavePath';
export const IMAGE_SAVE_PATH_ENV_VAR = 'SNYK_IMAGE_SAVE_PATH';

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

export function getContainerImageSavePath(): string | undefined {
  return (
    process.env[IMAGE_SAVE_PATH_ENV_VAR] ||
    userConfig.get(IMAGE_SAVE_PATH_OPT) ||
    undefined
  );
}
