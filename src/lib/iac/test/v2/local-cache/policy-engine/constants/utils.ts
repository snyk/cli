import * as os from 'os';

const policyEngineChecksums = `
0bd70d007a2b0ca81b8107886ab8ff4eae93ff12def5e3804188c18979d6b0b9  snyk-iac-test_0.57.20_Darwin_arm64
784a774ae192fe76e27a0c04e383d5dd07d13e586d91ac4786a7092dd93bd25b  snyk-iac-test_0.57.20_Linux_x86_64
c9f85636f4fa1744d1f4bfbba45a211baa91f82a56c2199cec7e8de991845229  snyk-iac-test_0.57.20_Windows_x86_64.exe
cba9f010e6e2b511761de65770520ced28b4da5dbe6e309434c4b55afb79e8d0  snyk-iac-test_0.57.20_Linux_arm64
de4eda1e0c1c564f026bfc1098d36331cf4f858c90a7d3876883dd2cdc888741  snyk-iac-test_0.57.20_Darwin_x86_64
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
