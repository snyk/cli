import * as os from 'os';

const policyEngineChecksums = `
1bc0af9da49216a52e8cef41f48b4544471930c3d9fb9cc549d2ff75a55589a1  snyk-iac-test_0.51.2_Linux_x86_64
410ee514e20bc796d070afb23b9fe66fdeca97358f965d92fb2d6359829e5ac8  snyk-iac-test_0.51.2_Windows_x86_64.exe
846b3d154a7ddd50f7aa64a8bba9b5436672acdd6efdca1a014ae239649a240f  snyk-iac-test_0.51.2_Linux_arm64
a67afe8f0ddd8456b2845253ba4ab0ad1aceb8bd04629b4947844c1db921ac19  snyk-iac-test_0.51.2_Darwin_x86_64
c3c90bb71e78978c73e68a04b8603f9d2a90e067cb0affd1b89d68090c6c74b2  snyk-iac-test_0.51.2_Darwin_arm64
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
