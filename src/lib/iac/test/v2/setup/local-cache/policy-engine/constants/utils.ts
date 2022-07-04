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
const policyEngineChecksums = `02c128be0fa66aac7bc0de57f8c3c35e84ace8dd8a4b5ecb6c28eed7c27b3c7d  snyk-iac-test_0.3.0_Darwin_x86_64
62038ace2d5731721ea28ff4fda81da6602838690ff1ecbc577fd3cfc6fc8cf1  snyk-iac-test_0.3.0_Windows_arm64.exe
73882e94b778f5b7e6bb19b9397ffb3d460d705eef8f1ca59144a37271042804  snyk-iac-test_0.3.0_Linux_x86_64
815d4383701ea22e04f29681de9b3c6196f6d5403890775af154ac7b38eb190d  snyk-iac-test_0.3.0_Windows_x86_64.exe
9e2350e093167fd001e38168464f1fa3768b999d7777c02d4ddc3afe534e1391  snyk-iac-test_0.3.0_Darwin_arm64
9e366df185f18a3cd93e92ecc84df68f2d1bddbb61f3c2af0d09911c5161e317  snyk-iac-test_0.3.0_Linux_arm64
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
    throw new Error(
      `Could not find checksum for ${policyEngineFileName} in checksums.txt`,
    );
  }

  return policyEngineChecksum;
}
