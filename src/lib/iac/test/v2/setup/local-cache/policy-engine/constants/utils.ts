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
const policyEngineChecksums = `1ddb892ef4dcadb0d1af897c4c1cd4f32ea391b82e88b1577d377a1cdeeb985c  snyk-iac-test_0.8.0_Linux_arm64
54acf3500d35c5f438260d20b04f22ee13e346412156fdd04ac9057f9ed94a2a  snyk-iac-test_0.8.0_Windows_x86_64.exe
7914dc0e3ebbb52da2a12506faa40df5097217cbfd056496872a3d418326b45c  snyk-iac-test_0.8.0_Windows_arm64.exe
7cdc4c096d44ce761d08aea2a0da55861b92cb6363fb274221d4837f723b3c11  snyk-iac-test_0.8.0_Darwin_x86_64
d0db415baaf5a8bba7ec2d909729aa91e7393ee95a81cb308a84c7efef4b8bbb  snyk-iac-test_0.8.0_Darwin_arm64
d35d12fccb766404a49de684df2a2cabecc78cb8f06ef0a9104e77ad26991e7d  snyk-iac-test_0.8.0_Linux_x86_64
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
