import { getVersion, isStandaloneBuild } from '../../lib/version';

export default async function version() {
  let version = getVersion();
  if (isStandaloneBuild()) {
    version += ' (standalone)';
  }
  return version;
}
