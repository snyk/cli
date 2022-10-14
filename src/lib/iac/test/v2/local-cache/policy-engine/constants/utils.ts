import * as os from 'os';

const policyEngineChecksums = `
06f0840a1429e0f2ebbd96e6d08a8e9c8a9c6184ff6172d3e7e1df4651540c8f  snyk-iac-test_0.33.3_Darwin_arm64
28197818fb18cf07138733170008853f605596e4cb01b9dd5d8729dec21ad820  snyk-iac-test_0.33.3_Linux_x86_64
364d196b1ec6cd866c2116cf2a0998fd75ed6981d2b338b4d0dc43d3c18ea9d1  snyk-iac-test_0.33.3_Windows_x86_64.exe
57714bec7ca5cc141ff2aae3b692b70a81f32b026d1b81f23bd68bc39d57be71  snyk-iac-test_0.33.3_Darwin_x86_64
8dd58fda7f864939b97f0d00246bd4915b9054f271e14bfa93b292ffdc6e9f34  snyk-iac-test_0.33.3_Linux_arm64
d62e2dd1d51e3a1d75e62d7eb76820b5be146d49f449dc6c47c4edae11b5f219  snyk-iac-test_0.33.3_Windows_arm64.exe
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
