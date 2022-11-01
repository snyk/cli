import * as os from 'os';

const policyEngineChecksums = `
13c015a69f9c9ce75c28cbbe0f4a97753121bd295ce5163b3c8390b246b47672  snyk-iac-test_0.36.1_Windows_x86_64.exe
2eb835f9283f8a57830a39d69f742d137b0f94330cf15a99002ec492988197de  snyk-iac-test_0.36.1_Linux_arm64
4f405047677420287fb88c5c93b6eb69c498ab425d68872b1234c8296bf518fa  snyk-iac-test_0.36.1_Darwin_x86_64
6b2bd24ed2ed3ffb8168a56830738dafd5e8674d67e5ea5c64d3f58e3a224f7e  snyk-iac-test_0.36.1_Linux_x86_64
de8bffb9046568c2b909fa297214c6a6682d22b97bd6466a56ec5fd09933751b  snyk-iac-test_0.36.1_Darwin_arm64
fdbb1d8bde065fc2989f502c16c0244cfe3ed7f45f927729a367a47f4119c4de  snyk-iac-test_0.36.1_Windows_arm64.exe
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
