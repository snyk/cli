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
const policyEngineChecksums = `40b4570770baf6dd1460853eb6f197789b7144aaa0296ef57f6b612f8a603fbd  snyk-iac-test_0.11.0_Windows_arm64.exe
44bd4617563748b4e2d5510f05bd2257eee583b16b134699d9a7f1254d58b50e  snyk-iac-test_0.11.0_Darwin_x86_64
8505898c9681069c0598c00880a232aa2c56bae37fa5cef194773557d6196053  snyk-iac-test_0.11.0_Linux_x86_64
a942363e6f180ab8b3f42189dc930a34502d8a337d7fb31a13e86156548882a2  snyk-iac-test_0.11.0_Windows_x86_64.exe
c1bec59099ac0afb486b289a8690f9e9a065e5f5f4424ebe0186ed98f8179a99  snyk-iac-test_0.11.0_Linux_arm64
f21e7d665ab8d7aef65d7c5cb516ab7091928c13b32d1a727bd795b3a7029d70  snyk-iac-test_0.11.0_Darwin_arm64
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
