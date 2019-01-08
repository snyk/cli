import { gte } from 'semver';

const MIN_RUNTIME = '6.5.0';

export const supportedRange = `>= ${MIN_RUNTIME}`;

export function isSupported(runtimeVersion) {
  return gte(runtimeVersion, MIN_RUNTIME);
}
