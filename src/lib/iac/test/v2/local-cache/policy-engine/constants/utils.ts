import * as os from 'os';

const policyEngineChecksums = `
04fe9c50afad4ab91815281930f142d17e4047d0187564fffa81d2a04e292915  snyk-iac-test_0.35.1_Windows_x86_64.exe
2876226d01d3b8c906bc1835d8f03ebb7b809b8a3bbce3e743d3301df86664b5  snyk-iac-test_0.35.1_Linux_x86_64
36dbb048fc79669a7ae4924079a44248eeed83a5e785fa3877bb275d28f7be42  snyk-iac-test_0.35.1_Darwin_arm64
4d08c4fe6027685681171903669372323f6018083bcc67ce804fd4a939ed4859  snyk-iac-test_0.35.1_Windows_arm64.exe
4da012c52785749e24695d8b7f70782697afb06cc0125b6e3d062ba19d65b479  snyk-iac-test_0.35.1_Linux_arm64
d6e017549e2806df32ecd61052d5f7489cca213a437af68d7e982b6200f8f81a  snyk-iac-test_0.35.1_Darwin_x86_64
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
