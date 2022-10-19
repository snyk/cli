import * as os from 'os';

const policyEngineChecksums = `
057406a372f29f765b41b32f67414224595caf5ce4aa17619ee6e12e95cd6050  snyk-iac-test_0.34.1_Windows_arm64.exe
1a37bb164198051ede0f45e3fcfabf3de4932c2ac4ef9f271514d921b287cb96  snyk-iac-test_0.34.1_Linux_x86_64
316c911299558c66e38c38f5205fbac10cee2cffa3f34e20bb4785950964a957  snyk-iac-test_0.34.1_Darwin_arm64
7e8ea9c57f4a846f39ffb3843db4c2dc9f164669a3ae8084c68b425039160264  snyk-iac-test_0.34.1_Windows_x86_64.exe
dcd933804997898aa40744d6e42a97b6990243a55f1396dcc9a6d6e1db5b534c  snyk-iac-test_0.34.1_Linux_arm64
f15d4093f0f0d2ae573a61add594ad7481c2f57474543203d3e3e419ba04cd3b  snyk-iac-test_0.34.1_Darwin_x86_64
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
