import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
1577b258cbdd083b232f5a4d6e579f57678a42bf17cf5cec812e50aa9f400f35  snyk-iac-test_0.47.2_Darwin_arm64
4e76a831c087e1e9dacf278a4b4c3b01f4ffeb49c15ce1192fd36c580ece30fc  snyk-iac-test_0.47.2_Linux_x86_64
a420d4655be8fde67652461d1c311c912f1fa99a07989f752a1e9fd54303b5b9  snyk-iac-test_0.47.2_Darwin_x86_64
b4e68106d88b7e28d089289b9ee73abe6025df0307e189397f17d88002029d9e  snyk-iac-test_0.47.2_Windows_x86_64.exe
c1ca5fbf2fb09e99b95bef456e0f360fbe5a5068d9b5a6dcfd4efea16add6681  snyk-iac-test_0.47.2_Linux_arm64
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
