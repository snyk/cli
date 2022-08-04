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
const policyEngineChecksums = `09503affce0653bd3e1d7f0be729f4e72afef48cda5e7cfb0659ccf4e12f6145  snyk-iac-test_0.14.0_Darwin_arm64
2d415c7718280180db83786f120c666e82ae686df7f2c3df6410a39216245106  snyk-iac-test_0.14.0_Windows_x86_64.exe
43286fb25c8f99842c89e906a3791f3668f04d336dad762a349398a8a7e8431b  snyk-iac-test_0.14.0_Linux_x86_64
7ae1033a948f8868d6643759a3ee46bf076fbd2cf0bd28f6c687a9099dbcde04  snyk-iac-test_0.14.0_Darwin_x86_64
92913a9d3a48c196f29d361d7f3bb79759f558793c37292fe5dfa671f2f18e39  snyk-iac-test_0.14.0_Linux_arm64
a228cde202ac394e7b5180a1dcd33bc5d8c7053e4c8bf3584dd0a414ff7acc74  snyk-iac-test_0.14.0_Windows_arm64.exe
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
