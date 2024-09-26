import * as os from 'os';

const policyEngineChecksums = `
020098c4dce6a7412e7aaffc379f5b668886ce1dfbcb584241985ac4de6be7f4  snyk-iac-test_0.56.0_Darwin_arm64
07a682745d31048a1d279da53cdda2ddf75607bc90348d18d9c6b86cbeff6b81  snyk-iac-test_0.56.0_Windows_x86_64.exe
1f46cc456e5261bf7b789a44621dfc1e1676b48679e9e89478107f40636011e6  snyk-iac-test_0.56.0_Darwin_x86_64
4f58f39a93119a8acd74469d54f3bee53c4fb0e22a161b3311ccb9ac4cef4dad  snyk-iac-test_0.56.0_Linux_arm64
e29ace0c3d2ac60b2aec2ed50a93c8e6ba839cecb75dc6f057d02dc21a090e96  snyk-iac-test_0.56.0_Linux_x86_64
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
