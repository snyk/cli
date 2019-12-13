import { satisfies } from 'semver';

const LEGACY_RUNTIME = '^6.5.0';
const MIN_LTE_RUNTIME = '8.0.0';

export const supportedRange = `${LEGACY_RUNTIME} || >= ${MIN_LTE_RUNTIME}`;

export function isSupported(runtimeVersion) {
  return satisfies(runtimeVersion, supportedRange, { includePrerelease: true });
}

export function isUsingNode6(runtimeVersion) {
  return satisfies(runtimeVersion, LEGACY_RUNTIME);
}
