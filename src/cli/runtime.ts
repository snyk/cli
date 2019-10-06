import { gte, satisfies } from 'semver';

const MIN_RUNTIME = '6.5.0';

export const supportedRange = `>= ${MIN_RUNTIME}`;

export function isSupported(runtimeVersion) {
  return gte(runtimeVersion, MIN_RUNTIME);
}

export function isUsingNode6(runtimeVersion) {
  return satisfies(runtimeVersion, '6.x');
}
