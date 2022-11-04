import * as os from 'os';

const policyEngineChecksums = `
120e23fb44b685ae5bb4181785036294dc6287601c28940eabd2d1dc8337c681  snyk-iac-test_0.36.2_Darwin_x86_64
2c6c3570dc7f177efa892ece2d11ca22e096525c4281f36b9ba49f8d506402a5  snyk-iac-test_0.36.2_Linux_arm64
3838f0e1fa2616173c24a3a2359e1a2eee73b95e2d1afb6201515fef63cbe331  snyk-iac-test_0.36.2_Windows_arm64.exe
64fbf879a4d2a2b1a47b21bee9ccebb279733758cb8f3cc8fc381f1b0dddb4c6  snyk-iac-test_0.36.2_Darwin_arm64
f2d4faa30a91ad2dd8a593694edbcd1a48b28517f20cde92baa87bd64f8e89b4  snyk-iac-test_0.36.2_Windows_x86_64.exe
f7be5aa25493735f1881c9e4a99d12b901599072bc74b709e8d7b0ce25d3367b  snyk-iac-test_0.36.2_Linux_x86_64
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
