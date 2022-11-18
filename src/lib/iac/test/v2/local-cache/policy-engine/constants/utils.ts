import * as os from 'os';

const policyEngineChecksums = `
1afdaaf18be007724f51e20808fde6ac83b3ff09952a7d417dc2c5b40314b001  snyk-iac-test_0.37.0_Windows_arm64.exe
524cbd8a952de3d6514be429b920aef1385d695cba5a60b450232c5965241cbd  snyk-iac-test_0.37.0_Darwin_x86_64
87bb6f2d36c7d0f1c6d7f80cd423fc660afb79502d976e10855607b13864711d  snyk-iac-test_0.37.0_Darwin_arm64
8c73b3c917ac51b82320ebfae308608784174d3ff34a3af0d621fd2be1b380a4  snyk-iac-test_0.37.0_Linux_x86_64
b32b5e7d28a7bdcda684bf8e09cdad9edc094f79345add7ca5b72dd4080948e7  snyk-iac-test_0.37.0_Windows_x86_64.exe
c04b118997104d51014fed4b89264f4fa7b83980a7d4619e67e2fcc7ec2174a0  snyk-iac-test_0.37.0_Linux_arm64
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
