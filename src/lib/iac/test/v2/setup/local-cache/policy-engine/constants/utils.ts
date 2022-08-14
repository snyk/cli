import * as os from 'os';

const policyEngineChecksums = `528fb9634e8eba009a07afba446648541dd664f8d1eaf4b3025b773dda62dd97  snyk-iac-test_0.19.1_Darwin_arm64
90a85040d859a82331c9de283f1c4c674e4856a5ca98a3a36640eec9a732e101  snyk-iac-test_0.19.1_Windows_x86_64.exe
b1dd144e8a921a9312b667425d6afdc45dc70d485ce7473f415465eee93cb69f  snyk-iac-test_0.19.1_Windows_arm64.exe
c74d3d5fd4ad35769ae0b8d5637c684f58a69ef5640a2a863bf120faa9b2c1a2  snyk-iac-test_0.19.1_Darwin_x86_64
d25fa0aac5ac399f2d06b6bb553a602ba99f83131543c0e5246bf50a3e584b18  snyk-iac-test_0.19.1_Linux_arm64
e5377a7e761949f78b532dc2daa5ea4d4da43e43c6393a5bbfd0d960953bdb6c  snyk-iac-test_0.19.1_Linux_x86_64
`;

export const policyEngineVersion = getPolicyEngineVersion();

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
