import * as os from 'os';

const policyEngineChecksums = `
07b2676b6356acc480267beb708e730d826c4949d1fb6d683f069360a6bfd077  snyk-iac-test_0.56.1_Linux_arm64
2f9c1546866cf393aced662061463a871f688f8abc228bb57b6bb415e3cf8c5a  snyk-iac-test_0.56.1_Darwin_x86_64
42695a4b2b25ef1ee84d62c4478158a07f748dbc2bcf90bb836b16853e5b614f  snyk-iac-test_0.56.1_Windows_x86_64.exe
7e16bd9fe511b5d8ada9a577f5fd9dc5761f868f3dac11af452ae872436576bc  snyk-iac-test_0.56.1_Linux_x86_64
df947b33c41a8c63020d4d3e2d8f405c004cafa06b866d62c1e3b29977732271  snyk-iac-test_0.56.1_Darwin_arm64
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
