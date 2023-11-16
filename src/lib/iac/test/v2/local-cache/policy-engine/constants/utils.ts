import * as os from 'os';

const policyEngineChecksums = `
11e8d1c999ce9bc5aa5cc4df0cb861b81ca564e8a53c41ba99511613638affdc  snyk-iac-test_0.50.2_Darwin_arm64
73cd835525852bf19998e0a0ba8c943b7d05cd3f0e5aa2bfa187987e5a5437e9  snyk-iac-test_0.50.2_Linux_arm64
870d025b3a33ad4e10f50f282b7052aa32e23736302327c56d26704acfbd159e  snyk-iac-test_0.50.2_Linux_x86_64
9478fdb959fc3bbe18ed5fb8d631d34f3217446f933d5c565a86c976a6297bc7  snyk-iac-test_0.50.2_Windows_x86_64.exe
e35327c2592cc7f0ec3676132be5fb038eaf6c3ac3f2560485fb7f734ef7a8e6  snyk-iac-test_0.50.2_Darwin_x86_64
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
