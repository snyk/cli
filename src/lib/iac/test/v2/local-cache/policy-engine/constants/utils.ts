import * as os from 'os';

const policyEngineChecksums = `
0cb968b3547cc074c68fda705773ed87748869562fedcd580c6ec6a08c542404  snyk-iac-test_0.32.0_Linux_x86_64
3326e5f31086dbf013361c6dc9360852953917236d211ceacde004ab0377e423  snyk-iac-test_0.32.0_Linux_arm64
54ced701a5d739a58b3b557336895f109d6bea5b375138e12955f5c5b89a9b9e  snyk-iac-test_0.32.0_Windows_x86_64.exe
5c3bdfcfcce4548a32566f60d5619b4a0045368eb273ba52956815d7eeeb737b  snyk-iac-test_0.32.0_Windows_arm64.exe
6bed31a6829b4a54ba33b0f2a60fab25176720fbb99ea0eab820217faf053cb8  snyk-iac-test_0.32.0_Darwin_x86_64
88090f61231e1327e66a60be9252cf1295b6fdb0d4817809760d9aadc3942580  snyk-iac-test_0.32.0_Darwin_arm64
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
