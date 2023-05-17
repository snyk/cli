import * as os from 'os';

const policyEngineChecksums = `
0654d42d5d19db79d34c3696a9c0f9666408a37ded66f1d1b650754a17803e71  snyk-iac-test_0.44.0_Windows_arm64.exe
1205b296c94d88e49bdc4f9c64ceac294c5aa391c4a9d8b913853ca257dad993  snyk-iac-test_0.44.0_Linux_arm64
3173eb18d0050649991d449eaf58f47794790dac019b14d01a7c1cee94d2e15c  snyk-iac-test_0.44.0_Linux_x86_64
479df564deb9f574b7231d9139622b8cc5cace64b0200bd68cbc077426f8b9f1  snyk-iac-test_0.44.0_Darwin_arm64
64170fd4f52670f1751dd38bd23ba5a845783b8d11077838e4398e4331877509  snyk-iac-test_0.44.0_Darwin_x86_64
8f53143ce7140362311ecb01dedaf909069d1171c7b39af120ddafb42e9ffbb0  snyk-iac-test_0.44.0_Windows_x86_64.exe
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
