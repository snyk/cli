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
const policyEngineChecksums = `0a2566f393a963c4a863e774fb4fa055ecc5fd018407f4c92213085592693eb9  snyk-iac-test_0.15.0_Linux_x86_64
5d46d756f849704cd811707e552dd9a9e047b01ea6ea43ce424ddd41936b295f  snyk-iac-test_0.15.0_Linux_arm64
7c2e881766c26711cd51f5027ff0f84ffae02d419a6489fd219092e5a2b3253d  snyk-iac-test_0.15.0_Windows_x86_64.exe
8e1f0c5ba1e0c4b3344218e1373b81a48c25f7d58e755e3032b7f995e4f0a6f8  snyk-iac-test_0.15.0_Windows_arm64.exe
c456b9e7b0eb9c73e406cb955e5dfb6b0adc3cee92b3a17c23ec5f23f37f9eb4  snyk-iac-test_0.15.0_Darwin_x86_64
d6d6e9b0f722b125e7be5e21a03104babad6949bb7ca6f7e2b19cc044fda9169  snyk-iac-test_0.15.0_Darwin_arm64
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
