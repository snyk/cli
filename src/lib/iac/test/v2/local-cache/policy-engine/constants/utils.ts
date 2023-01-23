import * as os from 'os';

const policyEngineChecksums = `
579c215e142a3c771742a7099f2b786fdf382cb9931d8ce1662bf60f59e26d0e  snyk-iac-test_0.37.4_Darwin_x86_64
5d348a2bb2933596faac3e3d376248ea7acbe642097200d05e4c4a378d382be9  snyk-iac-test_0.37.4_Linux_arm64
71a37358468db9a41ef5a9a6a44b3385a1ae47cf106ed7cfca68e085653d33d8  snyk-iac-test_0.37.4_Linux_x86_64
8826f1617bfac7f26beb4fdc5bf903b8a04587e3c2846c3201292721b8a760dd  snyk-iac-test_0.37.4_Windows_x86_64.exe
a69a2b79bb4c27b8147682b7ac8f5433b2296f70f1864e0017d88ffe20089008  snyk-iac-test_0.37.4_Darwin_arm64
cabcfcf08c616a7762d19dd918f8edddcab7921eb6b7c628c3fb3981651c8666  snyk-iac-test_0.37.4_Windows_arm64.exe
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
