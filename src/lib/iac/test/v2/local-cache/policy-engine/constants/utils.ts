import * as os from 'os';

const policyEngineChecksums = `
49d098a9cba3c82396d6e46fd008bb8f72dda58a2e288c9ff23a8d4c5f15a4b6  snyk-iac-test_0.57.3_Darwin_x86_64
4daae85505600d1ab37265f6df8cc118c69d2219aa8f79b19616560d18744c06  snyk-iac-test_0.57.3_Darwin_arm64
783aa249e55a04f5b2811e9e8a5c6395b2ede1bc26fc3dbaacd69fc9756739cc  snyk-iac-test_0.57.3_Windows_x86_64.exe
e3ff14d4f4b2cf26353698b108aa9ca987191207a0e3b6cd3d56351255e7ef73  snyk-iac-test_0.57.3_Linux_arm64
fab10ed6395385cf06b95745e451e56ccb7a3e3ec0d7f541a7cf8047a3d27db7  snyk-iac-test_0.57.3_Linux_x86_64
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
