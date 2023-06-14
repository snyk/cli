import * as os from 'os';

const policyEngineChecksums = `
0a39b9452c027bd0d70a0893f5dc48c4edf986835bb98d1c0b45787ec44fc253  snyk-iac-test_0.47.0_Darwin_arm64
4206ed4482261f737e34b40b6d2902053bd7459e4e85daf2b6d0f451b661da52  snyk-iac-test_0.47.0_Linux_x86_64
61af6b582a93a6219a9be97cd77ede97d0a77766d1c76ce0b57c2c2e8d42ca97  snyk-iac-test_0.47.0_Windows_x86_64.exe
6e293fe5819bb78a42bd83a5cf9ee8dfd4f310f3da9af19e0a8ab0d688ca3c6d  snyk-iac-test_0.47.0_Linux_arm64
d06631f222f5a0152068ea2003f3f139f2bb88122d5948f5f65387702cd834df  snyk-iac-test_0.47.0_Darwin_x86_64
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
