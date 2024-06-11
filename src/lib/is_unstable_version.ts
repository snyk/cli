export function isUnstableVersion(): boolean {
  if (process.env.SNYK_INTERNAL_IS_UNSTABLE === '1') {
    return true;
  }
  return false;
}
