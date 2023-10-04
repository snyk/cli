import * as os from 'os';

const policyEngineChecksums = `
3c9f5eaffe9c8bc38e29281f31c93925bd8b265fbcc90f8271841e71ae5570d0  snyk-iac-test_0.50.0_Darwin_x86_64
526b45c0132f612266c210217220cb3e8c6158b1b1a5238ed25f4b98b6eaffe5  snyk-iac-test_0.50.0_Windows_x86_64.exe
54941a2be1d060aedbda27bf04a9943ab8d5d9fe34b2a3be38a9093b6abf8290  snyk-iac-test_0.50.0_Linux_arm64
8dae6e8d92ac545425fcad8bc04c1c6e98ddee78a11c1b3f326b97022499c27d  snyk-iac-test_0.50.0_Darwin_arm64
9b5857cc508d87703e50a2ae29e36a06d9263e23734fac6fb481a830b63e7d92  snyk-iac-test_0.50.0_Linux_x86_64
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
