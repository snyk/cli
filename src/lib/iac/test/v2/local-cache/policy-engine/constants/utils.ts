import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
20626360388524d227bdf81879c68c7f8ad0dd2bba4c7e42c349743852b0b2b9  snyk-iac-test_0.47.3_Windows_x86_64.exe
74543f6531114be163d29cb94df97eea3e7dd339215d4bf916cef6e5602e70b3  snyk-iac-test_0.47.3_Linux_x86_64
b241a20badec080b2e22def46dd0aa7e5d9d2141724f6829e289f12eb4274fd7  snyk-iac-test_0.47.3_Linux_arm64
b7391c1db40da0a280a97f45bc3734f7e7f2502458bd66a48c5338e0f2bb1f54  snyk-iac-test_0.47.3_Darwin_x86_64
b97aa3e5ef2bc1cfd282f6db6189e137be31f9847b61e57c4b9f525588fe95d5  snyk-iac-test_0.47.3_Darwin_arm64
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
