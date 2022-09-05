import * as os from 'os';

const policyEngineChecksums = `11bcf635e209023478f4291fe29e4aa5e4e719dde54dc0e333bae7a626ed6b6d  snyk-iac-test_0.29.0_Linux_arm64
557d4ab7b3c23b34ed81c31109140833dcc4863946774a4ba72d7b18800d4d34  snyk-iac-test_0.29.0_Darwin_x86_64
7f5db81dad9f7ae4d80c472757b67c37ab29bbb9a18174b30c3354e494fc1505  snyk-iac-test_0.29.0_Linux_x86_64
89de8e29d0aca232870bd1896aa5c66abb7917566de22d69ff847402b9566690  snyk-iac-test_0.29.0_Darwin_arm64
cc9d1b48530b69774162e06774fef930e91fb3fe4be8f73e8605a2a6ac7eedfb  snyk-iac-test_0.29.0_Windows_x86_64.exe
f1ea52361d5409ad0e2a492425a70c31797d91c999aa510eb7e99f27f575f0a8  snyk-iac-test_0.29.0_Windows_arm64.exe
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
