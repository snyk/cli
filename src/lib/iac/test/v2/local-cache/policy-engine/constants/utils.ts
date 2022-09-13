import * as os from 'os';

const policyEngineChecksums = `
16211f1b806a85127cad2f1165e39a679a82c6c3d0d6a0bc4fde196710280b73  snyk-iac-test_0.31.2_Linux_x86_64
931a8eb829c912251ae1d47c7b729148dca2bd3c60a4c8b564f614aeeee9d7c9  snyk-iac-test_0.31.2_Darwin_x86_64
9536c5b4b4bf6fef94dd110033311b4447857c43bb07d64f5d2bc498cb53366b  snyk-iac-test_0.31.2_Windows_arm64.exe
cf24c3b562f5c4282c029510cf679cabb5fa2a96bbf207cdd57f42e960173fb4  snyk-iac-test_0.31.2_Darwin_arm64
d3bc0efa5e7eec34e9cd2f226e3686329e4a4f371e532851e4d10226e250505d  snyk-iac-test_0.31.2_Linux_arm64
fcebb81c0745d8636d55ac9aa4582acbc38d93a496970d3069c19ab278b5ebb6  snyk-iac-test_0.31.2_Windows_x86_64.exe
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
