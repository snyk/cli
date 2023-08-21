import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
1b248c51c82e9a2270ff4b3c7e066a1a964b0538a3877d8113d466f12199188c  snyk-iac-test_0.48.2_Linux_arm64
25c8ccb5416272dd5d0eea91a58b63f6fdd042c0b6f27350018127777716969d  snyk-iac-test_0.48.2_Darwin_arm64
36b3226a0656a5e17d8992e40e70f34d547df191569da6ec04ef716d7b19372a  snyk-iac-test_0.48.2_Linux_x86_64
79c2bd86506398ecc4f17c68dda67ea9fe8254a25b7854f9e4f526764b384b81  snyk-iac-test_0.48.2_Darwin_x86_64
a78c4daf800d3b81fe8e2d4b2e867123b62d34d59395dd8c382edaa7af3c8158  snyk-iac-test_0.48.2_Windows_x86_64.exe
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
