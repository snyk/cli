import * as os from 'os';

const policyEngineChecksums = `
076e9c9be17bd0bac244af679c864620558ab1bda6d13562be5271c1a1a3d03a  snyk-iac-test_0.42.0_Linux_arm64
17b29c5c39caa962cded8a30647f55f1a63bf77d820c8bb034a8964ea0655355  snyk-iac-test_0.42.0_Darwin_arm64
1d12f5d02e7e8bac6dd2965a308804d699520aff6624af6b6019557eedea3c82  snyk-iac-test_0.42.0_Darwin_x86_64
27f68ef2eae39a2a06f45af3a4a67ff7fcc433cb8de96bf9ca788d90c49e397e  snyk-iac-test_0.42.0_Windows_arm64.exe
720a9ce6c08a93c875e031cf5ca96085a70d83e49aeb939823e7e62c0d01a75d  snyk-iac-test_0.42.0_Linux_x86_64
a6f386cae16d046273028dbb3e377f292371c2a52ab9678f8efbae9210c183d6  snyk-iac-test_0.42.0_Windows_x86_64.exe
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
