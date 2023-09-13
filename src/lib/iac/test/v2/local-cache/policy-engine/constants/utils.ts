import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
1f2be3e4d03459f8f14ec971f27e51668128e0c9ea087c9079c8acd6c57f7841  snyk-iac-test_0.49.1_Linux_arm64
275e734dab56ca4c7882c2a405fb354697675fa861a7c10f4d20056832a36294  snyk-iac-test_0.49.1_Darwin_x86_64
7d93b6a6555c4864230134527fb3b472743fea9cfdf7081679c764af74aef9cb  snyk-iac-test_0.49.1_Windows_x86_64.exe
d62cbf8ad8bf4f966cb9a043dce0d7f64e89eb91817cca75ea0254ba0c8dd335  snyk-iac-test_0.49.1_Linux_x86_64
fcde4a397efc687a96738f8193cec1dc6f46c5c57fc190d28192daaa16d1a83d  snyk-iac-test_0.49.1_Darwin_arm64
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
