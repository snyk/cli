import * as os from 'os';

export function formatPolicyEngineFileName(releaseVersion: string) {
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

// this const is not placed in `index.ts` to avoid circular dependencies
const policyEngineChecksums = `2613cc16ac1fccae16729d42d45688269a4eccc7732d72071139d2485f0f2292  snyk-iac-test_0.4.1_Linux_arm64
4960c97b0a33a7d6dc8f6b74708e2ca9533d5da0f442313dd490fe057c55869d  snyk-iac-test_0.4.1_Linux_x86_64
71837d9a3cba579baaf2bc157e06ce000c2e043f69ab59aec57bf296ac45319c  snyk-iac-test_0.4.1_Windows_arm64.exe
7818f77ad78ce5b1e372181a173290c57fb15b039f206a681debdba4707f7cda  snyk-iac-test_0.4.1_Darwin_arm64
aec5181e9af19d16c6f2c0aa23b7d2b765f66c72be152a390daf886bf0128566  snyk-iac-test_0.4.1_Windows_x86_64.exe
bf0ce9cddec843b392627c000ae83f36e994fae07c8383a49c72aff08351746f  snyk-iac-test_0.4.1_Darwin_x86_64
`;

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
