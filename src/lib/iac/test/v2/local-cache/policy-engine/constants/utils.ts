import * as os from 'os';

const policyEngineChecksums = `
2e09361c270a1134c625c91e730d17a904f8a8c8f6607ffbe188cf0f539ed75c  snyk-iac-test_0.56.2_Darwin_x86_64
5e74c8b4193f28e65eb512d3c881a12837685ec1a747a44a3e922d69d0ad0637  snyk-iac-test_0.56.2_Linux_x86_64
788cb65446ff69df95db9c8791a154bba22272fb5859f3c52a8ebb757881deec  snyk-iac-test_0.56.2_Windows_x86_64.exe
d8720484d64ecdfcadc6d0d57c339c6aa825f758724f58fc487c817e4db5199c  snyk-iac-test_0.56.2_Darwin_arm64
da46dd35f2bed090c7ab61ad6fee23c0c6634b8d94a608681749342bac0cbdc9  snyk-iac-test_0.56.2_Linux_arm64
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
