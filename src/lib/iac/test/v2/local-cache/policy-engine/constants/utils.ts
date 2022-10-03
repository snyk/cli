import * as os from 'os';

const policyEngineChecksums = `
0f2a3f2eb4102aee4d1026319f2dd3ba12bdcd3d2da8897cde39ca7675149401  snyk-iac-test_0.32.1_Darwin_x86_64
1b94b34367b90e15b12d744bfc77789be915045d4c8a2cd0bc06d234ff31d741  snyk-iac-test_0.32.1_Windows_arm64.exe
582c6d3cc9542a46868a58fe548cb2fe03c2626f6bc28141ae69afa716608056  snyk-iac-test_0.32.1_Darwin_arm64
a16af28e5a9604ded8b51e246242427f51d36b9cc5c04e55206d0962ab01c7dd  snyk-iac-test_0.32.1_Windows_x86_64.exe
c9da3adcacc6439459dfb58b01ddb5d12fbeb3ca0ddf11cbaa2e6b0aaeef8f37  snyk-iac-test_0.32.1_Linux_arm64
f43f86ae7c46d1e2c938c5def8d4a04697505271c561e75d165ea62db01b500d  snyk-iac-test_0.32.1_Linux_x86_64
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
