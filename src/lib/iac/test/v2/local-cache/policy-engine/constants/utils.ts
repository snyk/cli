import * as os from 'os';

const policyEngineChecksums = `
01c559469b409cebe6caf83210b1a8e11739c7a0f8f03d657db746f90cf7b008  snyk-iac-test_0.33.0_Linux_x86_64
2411fdd002d0854f004bc620a4ee2f74c6d304985d9a1fdbc6834cb6cea37bc1  snyk-iac-test_0.33.0_Darwin_x86_64
df79c8a5c471c7e10f4f0e710ffb7db1aa63c66b8890bd39593fee0c8e6f1524  snyk-iac-test_0.33.0_Darwin_arm64
ea5897ab1b28305ce0cd1543b9c600157b3ae7d5d5b29e45a16cdbb2ca388ad1  snyk-iac-test_0.33.0_Windows_x86_64.exe
f428bb12dab32b18ad30837df048703a4d4d9ca477d70a50c4edcf8b4ce810e6  snyk-iac-test_0.33.0_Windows_arm64.exe
ffa45ff505631b82de77ceb39f2e859ab1738d9a93fbce782b0b8138c3a34e9f  snyk-iac-test_0.33.0_Linux_arm64
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
