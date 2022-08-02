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
const policyEngineChecksums = `4d238d35a90aba8049e4bf569cdd6c0f563984460353148f8f8a230827845de2  snyk-iac-test_0.13.1_Windows_x86_64.exe
6a19e64f5a685df8fc4ab388d52d0d493d6229a2e80e6429f23a614dfac9e9d3  snyk-iac-test_0.13.1_Darwin_arm64
6f1a66a1fb4e075887b9d495694f2062ae53936b4a0fa1c8a7bd9287669ea96c  snyk-iac-test_0.13.1_Darwin_x86_64
98f476ae50a1fb80cdd666a55dec14a1f2be9ceca9960335a8d122a1004d9fa5  snyk-iac-test_0.13.1_Linux_x86_64
b4b4023088a4184aa88674ee579e6ce96a9b9674fb9bac7173ff49419109de22  snyk-iac-test_0.13.1_Windows_arm64.exe
cf5d4d743614473535ff5479fc20fcbec89a614121ddad2c9bad853471ae803c  snyk-iac-test_0.13.1_Linux_arm64
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
