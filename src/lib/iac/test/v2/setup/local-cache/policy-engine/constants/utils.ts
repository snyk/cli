import * as os from 'os';

const policyEngineChecksums = `0faf6c7d65d46c1d05a729e5bd73a1f5638734a06f363a93f8e1489c75cc23e4  snyk-iac-test_0.20.0_Windows_arm64.exe
2eea4e2cf236feb694701a5fe19c81f04cca3486e354a0593b04982b02790e0e  snyk-iac-test_0.20.0_Linux_x86_64
a7631d19ac3eb2eb62b4381813bfe7b5583311150dd3d8eab512b0d2f24c7f18  snyk-iac-test_0.20.0_Darwin_x86_64
b266e90dc2f3fb2fb6c7f501b9906532680de245ae7572c6010e0f7168d64a40  snyk-iac-test_0.20.0_Darwin_arm64
ca351817c3cfacac52cb2e9c138ca9d7a7a748fcdf884029176279cd78a350e9  snyk-iac-test_0.20.0_Linux_arm64
e30f9277daac37e4f056396a111d0dc15144cb3abb7bced6b7386efa8258516d  snyk-iac-test_0.20.0_Windows_x86_64.exe
`;

export const policyEngineVersion = getPolicyEngineVersion();

export function formatPolicyEngineFileName(releaseVersion: string) {
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
