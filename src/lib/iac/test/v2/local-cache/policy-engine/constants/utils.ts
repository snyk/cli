import * as os from 'os';

const policyEngineChecksums = `
64d72e61b1b39ae74c069667b9ada4edfe6343df1fceeef49fbee54b60d8013d  snyk-iac-test_0.55.1_Darwin_arm64
86b1db19a733afdf623ac5dfcb4f59f29a534997673efc94b9a0b4c14aa6abff  snyk-iac-test_0.55.1_Darwin_x86_64
a4e30ef1e973a323a2fce72ba8dc7d507b74fd7c524b2a4e7617958980146860  snyk-iac-test_0.55.1_Linux_arm64
e0ecebc81e619b4e7f6616c720f30150cb373548937e78f8eb42878516a087f5  snyk-iac-test_0.55.1_Linux_x86_64
f8a8c2aa8081027baceae917dbecfacdb06c1fc8710b4d17d71ace96704112ce  snyk-iac-test_0.55.1_Windows_x86_64.exe
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
