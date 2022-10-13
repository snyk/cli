import * as os from 'os';

const policyEngineChecksums = `
33ae49727a450c3a160386e14414a3a1575c8cca07059fad058089bce02531e8  snyk-iac-test_0.33.2_Windows_x86_64.exe
84a244f6cab6a8c5a1d90e508612543daa56b159047a98c442aeffb5cd792b7e  snyk-iac-test_0.33.2_Windows_arm64.exe
92899734de7bec7651a36bea8a75dc3224c123cbc92e3068e284d879626c02ed  snyk-iac-test_0.33.2_Linux_arm64
97316a206f62066f591d5e030ea86ad9cacfe6be6ff75d2f350be45b5fcfc59a  snyk-iac-test_0.33.2_Linux_x86_64
9c253468a188c182ef01eb235c7078644010a1029e560990a72820122dd26144  snyk-iac-test_0.33.2_Darwin_arm64
d3a5a4aa07d99910fe7a3764869c435e39bc31fbb0a78a9c136251b98bc25fac  snyk-iac-test_0.33.2_Darwin_x86_64
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
