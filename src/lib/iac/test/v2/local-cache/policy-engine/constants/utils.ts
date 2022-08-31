import * as os from 'os';

const policyEngineChecksums = `283cb07a894f8252733e6634bef84fbc4fe98eac338239493753e20477150abb  snyk-iac-test_0.27.0_Darwin_arm64
55c6cae0b4805047d0f0d8f3eea74f12a4233211499cc2f006cee633f1f2e7b8  snyk-iac-test_0.27.0_Windows_x86_64.exe
7a845e2108c309a7bde435342b69d3ed172a36971779dbc2e1a9a96582f1c4fb  snyk-iac-test_0.27.0_Windows_arm64.exe
a06de762874686612d9d42b2eb165979f334413f6460a675f0559e8e56a264dc  snyk-iac-test_0.27.0_Linux_x86_64
ac3ece2e1d59927330c996d968dc5bf84faaa766f85402b56b3ae15fe2fae313  snyk-iac-test_0.27.0_Linux_arm64
d96eda3334548db4dc17ea9892b94f48a3a4187af13090118e04cdbd23c821b7  snyk-iac-test_0.27.0_Darwin_x86_64
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
