import { getVersion, isStandaloneBuild } from '../../lib/version';

export default async function version() {
  let version = await getVersion();
  if (isStandaloneBuild()) {
    version += ' (standalone)';
  }
  return version;
}
