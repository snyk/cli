import * as os from 'os';

const policyEngineChecksums = `
50a0af84203660f5a023c949921596e22b92987a0b35d4d07e06bcaf48f2d0d0  snyk-iac-test_0.41.0_Darwin_arm64
01ca4b4b5cc0dd8d0e1c91ae649191aa9111a239dbd6ebf854cf9a80ed26a05c  snyk-iac-test_0.41.0_Darwin_x86_64
1c52a7e8b9f85a49f0da7fcf8a0ef67e547c003eeb183df22006b93adf97305c  snyk-iac-test_0.41.0_Linux_arm64
0de09e1e9fed752cacc59ef5ac01a9291cc4e035186cac7242190e389df91675  snyk-iac-test_0.41.0_Linux_x86_64
87eb40a77f2553a1190b2ae303cb184f62ed5bd611f18a53d2e0a841fef8a99c  snyk-iac-test_0.41.0_Windows_arm64.exe
98437131a4de041bd2ec3a851606f5ecae375d34b5e2fc749dc5391ec254919a  snyk-iac-test_0.41.0_Windows_x86_64.exe
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
