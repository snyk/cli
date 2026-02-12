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

export function isTrue(value?: boolean | string): boolean {
  return String(value).toLowerCase() === "true";
}

// This strictly follows the ECMAScript Language Specification: https://262.ecma-international.org/5.1/#sec-9.3
export function isNumber(value?: boolean | string): boolean {
  return !isNaN(Number(value));
}

export function resolveNestedJarsOption(options?: Record<string, any>) {
  const safeOptions = options || {};

  return [
    safeOptions["nested-jars-depth"],
    safeOptions["shaded-jars-depth"],
  ].find(isDefined);
}

// Must be a finite numeric value, excluding booleans, Infinity, and non-numeric strings
export function isStrictNumber(value?: boolean | string): boolean {
  if (typeof value === "boolean" || !value?.trim().length) {
    return false;
  }

  const num = Number(value);
  return Number.isFinite(num);
}

export function isDefined(value?: string | boolean): boolean {
  return value !== "" && value != null;
}

