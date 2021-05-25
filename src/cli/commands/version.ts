import { getVersion, isStandaloneBuild } from '../../lib/version';

export async function versionFunc() {
  let version = await getVersion();
  if (isStandaloneBuild()) {
    version += ' (standalone)';
  }
  return version;
}
