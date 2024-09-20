import * as os from 'os';

const policyEngineChecksums = `
0946d45f8a4a2108af5019a54aeabee9a06c03830fd23a42ce59b914863e14b4  snyk-iac-test_0.55.0_Darwin_arm64
1b94bc7f10336732d67cba8afcff7536ddd6ee2bfe3aa7160e0ca70addcf9ecd  snyk-iac-test_0.55.0_Linux_arm64
30b32dd4a4b366a79dc730193a9828219a99a2d0af3ec5754fc6b890e0a6cc37  snyk-iac-test_0.55.0_Darwin_x86_64
9ad3597d28590b21ecc7d74835d9fe734d5a45e52e5bedb4957adea3c21d41c4  snyk-iac-test_0.55.0_Windows_x86_64.exe
efd13679aeede92d549f0ead0f16d394e6efed376fc8718fadc653faa0941a35  snyk-iac-test_0.55.0_Linux_x86_64
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
