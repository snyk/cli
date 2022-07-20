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
const policyEngineChecksums = `149794ee99d273cd461eb51dd0df6cac2d3b0eddc6f2c612af669bd1aa1b5ada  snyk-iac-test_0.7.4_Darwin_x86_64
3263270469e144061e86caedea33c5df2917b036be0f78727880c802e1e5dbaa  snyk-iac-test_0.7.4_Windows_arm64.exe
61fb24c4f70e0d6039d563d72bbaee3e7cb998b6f1486ad97fd43fddfeedcb42  snyk-iac-test_0.7.4_Darwin_arm64
a466c326389c6f7e004b24ad2f5761e28b739832a48c9efcbf812a639280481b  snyk-iac-test_0.7.4_Windows_x86_64.exe
f36a16eaf98bb4681c8dc60ae7301d56c6bd8b3595de0fe2baf2561a3cd3071a  snyk-iac-test_0.7.4_Linux_arm64
fc0cdeb5c358c21a163e00c117cf6ae526d289fb04523e7e0ee91f2da7c52e66  snyk-iac-test_0.7.4_Linux_x86_64
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
