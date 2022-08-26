import * as os from 'os';

const policyEngineChecksums = `56b32bea2a67c546d7d86d7ea7128664499956f5ae7f1db7f9f66b26069c3d7b  snyk-iac-test_0.24.1_Darwin_x86_64
6d83a25074a3cb3ca5b715e853d06fe0504bd185fecd80fde2bbdc838835f378  snyk-iac-test_0.24.1_Darwin_arm64
6e54515b5f7d84f90cc893cd81868a927cb413ed71303939c7f62e2f5414e18f  snyk-iac-test_0.24.1_Windows_x86_64.exe
87c224f936a4e6a969eb2b62767d793ec93dea494b12e508b9d69890fd4b2e22  snyk-iac-test_0.24.1_Linux_x86_64
df043f48385f4c6e5bd529125d5b9673adc36197fffd47655f19f5c790fbefb5  snyk-iac-test_0.24.1_Windows_arm64.exe
dfef8e2e83a4d967e3e2897b8795f22aa2fc9f0565c02ad80fa157085dfd61f8  snyk-iac-test_0.24.1_Linux_arm64
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
