import { gte } from 'semver';

const MIN_RUNTIME = '8.0.0';

export const supportedRange = `>= ${MIN_RUNTIME}`;

export function isSupported(runtimeVersion: string): boolean {
  return gte(runtimeVersion, MIN_RUNTIME);
}
