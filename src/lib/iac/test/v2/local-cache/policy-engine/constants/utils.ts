import * as os from 'os';

const policyEngineChecksums = `
4ca8405f821304271e477712e38338f6ab52ac16df2bf2ea18e0f543d8bbd939  snyk-iac-test_0.37.1_Windows_arm64.exe
7f8da19d89d09ec8a5f14c534e3c62f3e2096a51b171bf61c52312c705183dbb  snyk-iac-test_0.37.1_Windows_x86_64.exe
9c2f4bc77e7cf43ba81b5ca6036360463cb06337d90a892a29c8bb1c193e576d  snyk-iac-test_0.37.1_Linux_arm64
b8ce746ff9db7737aea49c69fb2c8389acd5ab97ec65f3c7f66c468ce6b65878  snyk-iac-test_0.37.1_Darwin_arm64
c45b9dc0fe880ad5ca7a14c46855d33f5d3020bea3c7e1db67199499a707bdfa  snyk-iac-test_0.37.1_Linux_x86_64
fa5fc53fd1ee825c091ab4f42e188b23ec289df00c06aba6b36735f8801372a5  snyk-iac-test_0.37.1_Darwin_x86_64
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
