import * as os from 'os';

const policyEngineChecksums = `
4c5ff6965107bcace62ea7fef2a3814c09192927dd26891d2430f8b80006e0bd  snyk-iac-test_0.43.1_Linux_arm64
867d2a60d61962e91da3cf7e361a02bcd569375a48ea4f90d870915e8b34cb0e  snyk-iac-test_0.43.1_Linux_x86_64
8cc597b3a1c0c1af211712b472229d19258b4f95d40321c6b469570ddc139df8  snyk-iac-test_0.43.1_Windows_x86_64.exe
be59d4fd5e21933dd496d071b40ac30b085976206a293a0f0b17b0b8d4785970  snyk-iac-test_0.43.1_Darwin_arm64
e46198f49c30cff2ddcc4590bc477e9801f977e1297c435bef940239e644b4ed  snyk-iac-test_0.43.1_Darwin_x86_64
fca0220b00de35a126b2d0fa912b03927e623967dd7f0d3bb3bb3afc5f99233e  snyk-iac-test_0.43.1_Windows_arm64.exe
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
