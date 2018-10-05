import {gte} from 'semver';

const MIN_RUNTIME = '4.0.0';

export const supportedRange = '>= 4';

export function isSupported(runtimeVersion) {
  return gte(runtimeVersion, MIN_RUNTIME);
}
