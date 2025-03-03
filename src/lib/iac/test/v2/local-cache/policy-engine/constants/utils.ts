import * as os from 'os';

const policyEngineChecksums = `
2bece98c6602298aab72fe8be803cd48974b63766c2a53491761d0855dccef0d  snyk-iac-test_0.57.5_Darwin_x86_64
3703de51908fb24ea11358c1f97643937b502a43afac5131d45c11a321138687  snyk-iac-test_0.57.5_Windows_x86_64.exe
458e9debc734006ce6bb4ae530111ad0548a3d85ca43f8b4b5f0b17994e75efd  snyk-iac-test_0.57.5_Linux_arm64
c624ddaa85851ed8c9fb54895c8834d0f04221066feb7d08afd2413ae2cf97cc  snyk-iac-test_0.57.5_Darwin_arm64
d15e89f5933933b13693f5ee42b27799825a1abc16e0bdbd5a2c40c5b5af8f9b  snyk-iac-test_0.57.5_Linux_x86_64
`;

export const policyEngineVersion = getPolicyEngineVersion();

export function formatPolicyEngineFileName(releaseVersion: string): string {
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

export function getChecksum(policyEngineFileName: string): string {
  const lines = policyEngineChecksums.split(/\r?\n/);
  const checksumsMap = new Map<string, string>();

  for (const line of lines) {
    const [checksum, file] = line.split(/\s+/);

    if (file && checksum) {
      checksumsMap.set(file, checksum.trim());
    }
  }

  const policyEngineChecksum = checksumsMap.get(policyEngineFileName);

  if (!policyEngineChecksum) {
    // This is an internal error and technically it should never be thrown
    throw new Error(`Could not find checksum for ${policyEngineFileName}`);
  }

  return policyEngineChecksum;
}

function getPolicyEngineVersion(): string {
  const lines = policyEngineChecksums.split(/\r?\n/);

  if (lines.length == 0) {
    throw new Error('empty checksum');
  }

  const line = lines.find((line) => line.length > 0);

  if (line === undefined) {
    throw new Error('empty checksum lines');
  }

  const parts = line.split(/\s+/);

  if (parts.length < 2) {
    throw new Error('invalid checksum line');
  }

  const components = parts[1].split('_');

  if (components.length < 2) {
    throw new Error('invalid checksum file name');
  }

  return components[1];
}
