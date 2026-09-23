import * as os from 'os';

const policyEngineChecksums = `
a849b3a52c27bbd5ab4a0ba12d3de10ded349d63e6d70fb59912eb95f52e8e8f  snyk-iac-test_0.57.17_Darwin_x86_64
214053958fa87448f3bddccccf6d187620abe9e7d4dcdd798815db37d80bc3e9  snyk-iac-test_0.57.17_Darwin_arm64
be68ef3326bc28bb89a868a133850bbfbc546d4febed6f86dc9748937dfb0eb9  snyk-iac-test_0.57.17_Linux_arm64
b81bcc24a56890c32c375ec6e28bbf003426f9396854c7fcfa349655407f3078  snyk-iac-test_0.57.17_Linux_x86_64
e58f0d0847e6198b005316ae221fd1e53d83cfcd4e81ccaf46c06c729b8b66ca  snyk-iac-test_0.57.17_Windows_x86_64.exe
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
