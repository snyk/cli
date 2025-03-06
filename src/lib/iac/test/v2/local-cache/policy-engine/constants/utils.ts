import * as os from 'os';

const policyEngineChecksums = `
03c218b11f0e2ce2bf6e845cc0f314368900fc966f50d630da961eb7ef02aa2b  snyk-iac-test_0.57.7_Linux_arm64
3062c2b9604412ba6f8fbb185220b656785d9f5634c800db8f0d25f62470433a  snyk-iac-test_0.57.7_Darwin_x86_64
58da235defa00fb86c33911522e400242a461749c0738624514ce236a07e659d  snyk-iac-test_0.57.7_Windows_x86_64.exe
61b106f260b01567b9407a2d7921a386d510d7231622b26b4bbbad630c541534  snyk-iac-test_0.57.7_Linux_x86_64
c08b7954b6ee1605ad2caec68e3575d4a007aad831872d062a14263073bea24a  snyk-iac-test_0.57.7_Darwin_arm64
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
