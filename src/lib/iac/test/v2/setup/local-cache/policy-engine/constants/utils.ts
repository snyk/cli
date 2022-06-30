import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export function formatPolicyEngineFileName(releaseVersion: string) {
  let platform = 'Linux';
  switch (os.platform()) {
    case 'darwin':
      platform = 'Darwin';
      break;
    case 'win32':
      platform = 'Windows';
      break;
  }

  const arch = os.arch() === 'arm64' ? 'arm64' : 'x86_64';

  const execExt = os.platform() === 'win32' ? '.exe' : '';

  return `snyk-iac-test_${releaseVersion}_${platform}_${arch}${execExt}`;
}

export function getChecksum(policyEngineFileName: string) {
  const checksums = fs.readFileSync(path.join(__dirname, 'checksums.txt'));
  const lines = checksums.toString().split('\n');
  const checksumsMap = new Map<string, string>();
  for (const line of lines) {
    const [checksum, file] = line.split('  ');
    if (file && checksum) {
      checksumsMap.set(file, checksum.trim());
    }
  }

  const policyEngineChecksum = checksumsMap.get(policyEngineFileName);
  if (!policyEngineChecksum) {
    throw new Error(
      `Could not find checksum for ${policyEngineFileName} in checksums.txt`,
    );
  }
  return policyEngineChecksum;
}
