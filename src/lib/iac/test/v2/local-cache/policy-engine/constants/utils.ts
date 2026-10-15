import * as os from 'os';

const policyEngineChecksums = `
1ae70de4152225e85c184a7474f8c9032640b6073058ddf43e3ad4725b18e6c1  snyk-iac-test_0.57.18_Darwin_arm64
220dbe3b9ddb491250af97130f385cea1c4eb1ee3617ed8e5b2be7f902bdc5f1  snyk-iac-test_0.57.18_Darwin_x86_64
54df008c3cf2ee2513079694d533a1341d199b5685557e3d4ae27c1478a7febe  snyk-iac-test_0.57.18_Windows_x86_64.exe
e66c585dc371865b2201e2f8fc1e0c441c55312e78445dcd60391f8e40bd7987  snyk-iac-test_0.57.18_Linux_x86_64
f1c4eb5c906a4bedbecf655e7ff5db4ce934e9cad5571caa7e707c461a4d61ee  snyk-iac-test_0.57.18_Linux_arm64
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
