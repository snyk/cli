import * as os from 'os';

const policyEngineChecksums = `
608ab9e5e5838f74e4ab792698f5a3885fcb4c000b80e5a127a46b5ae41e9724  snyk-iac-test_0.33.1_Linux_arm64
92bd7a0ed482ba0abd10fb2758bf266d9768d082cd2cdf6d2464f4e673005642  snyk-iac-test_0.33.1_Windows_x86_64.exe
b6f1923f7c39f7e60e825f00d8281edf138138e0f169521ecef276aef3721c43  snyk-iac-test_0.33.1_Darwin_arm64
cec7393fb81484c8cfc9fddbe4901e48f9b8aa7bd9adfa2af587054d550afb86  snyk-iac-test_0.33.1_Darwin_x86_64
dde1251ec714d4df5308b87bf35c13fe36a4d4c54188e62f93e1c253f8f14b55  snyk-iac-test_0.33.1_Linux_x86_64
efb42374a1f438456fe058aca200d13fef6c2438192615574542938229c2bcb6  snyk-iac-test_0.33.1_Windows_arm64.exe
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
