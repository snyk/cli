import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
1ae05be14d6175e5675070145eb128910aba5c061718cdb0dccdb19730f5e26f  snyk-iac-test_0.48.3_Windows_x86_64.exe
39544d73ac7284e9417975a594e113cb6568db3b08284e6efbe5036b3f15b33c  snyk-iac-test_0.48.3_Darwin_x86_64
84b5a025db9dee50b8b5ca7974e4444629ecc244475c586b6482b2f3652cf0f2  snyk-iac-test_0.48.3_Linux_arm64
c11e99321956f0b23e4bee5a44b6a4048783a7a382e7439e442f88af244393d3  snyk-iac-test_0.48.3_Linux_x86_64
f84205022454c25d6ce0e47489f5942d6ea3ff4ea574471e63619efeac90ec8f  snyk-iac-test_0.48.3_Darwin_arm64
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
