import * as os from 'os';

const policyEngineChecksums = `
220f4633530056053ab1805b553b71c71f01a6cef63409afe968227ddbc40dda  snyk-iac-test_0.57.10_Windows_x86_64.exe
31199556c8a42a50c1b08210acb0463152d56769f3fe77dd7da54db88504ef4e  snyk-iac-test_0.57.10_Darwin_arm64
81cf580b14d0f2df7d6b731c2bdc23a1a784be5254c036fe0dac5b3e18127ba1  snyk-iac-test_0.57.10_Linux_x86_64
bea67e70c80508683298ce6e7d1b744c5cef0e83c51b7936ba50251fff73cd79  snyk-iac-test_0.57.10_Linux_arm64
c5fcba71b9594f60ff1506a770d55a8b3b32aed44657e2609e572c0160463a2e  snyk-iac-test_0.57.10_Darwin_x86_64
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
