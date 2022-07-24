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
const policyEngineChecksums = `0922eac719d34468bd980dfd598963560875792ff4c4e95e9e33419750f17d5d  snyk-iac-test_0.7.5_Windows_arm64.exe
9fcff76be244bf1942ae1250cd8a1dd65029b263a68f33e8b2597319184e28b8  snyk-iac-test_0.7.5_Darwin_x86_64
a10c6cec78085ff0a842294949d4b220f3287783fb837a8be3d504d06f4263a3  snyk-iac-test_0.7.5_Windows_x86_64.exe
a2e43fcf862ef22184209a4cf729778b32f26f19b7385c5e3e5694777215070b  snyk-iac-test_0.7.5_Darwin_arm64
d68e5fd7e9376c473680cf20fe17242f98ffad3f7b6222a73c741da93ca7fe7a  snyk-iac-test_0.7.5_Linux_arm64
f696accbb6a8a8de902cab3ddee8f81e9b5d5dc9f6a321a33b5713d6e3230e39  snyk-iac-test_0.7.5_Linux_x86_64
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
