import * as os from 'os';

const policyEngineChecksums = `
3dbe4e30bbcc1006ab6549ffd1e6c62f3d8be514b5b7cb6324b20b69a5de1694  snyk-iac-test_0.45.2_Darwin_x86_64
6a329f5c5693e61f9d5a698c7f7df88ac0b9c4f337cb511edd7c7560908f0309  snyk-iac-test_0.45.2_Linux_x86_64
70907fcf977d55120304ccddec014bb636e83126b8e945b438028a99da7bd2d3  snyk-iac-test_0.45.2_Darwin_arm64
8a5a3d01f150efae5679010c4cdb58fd8ecb74c4b10117c0b3fa0f45898908eb  snyk-iac-test_0.45.2_Windows_arm64.exe
8c1a85ec74e1ed46a03e41407e6c38a2d36a58bdc9c0a55ad2b16b86c2b153e8  snyk-iac-test_0.45.2_Linux_arm64
d77e0bd941f3a3fde7348637ff1d0633e5e5703806cd1295d0107b8f8c461799  snyk-iac-test_0.45.2_Windows_x86_64.exe
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
