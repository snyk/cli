import * as os from 'os';

const policyEngineChecksums = `
0438c67095e46c8560c302c10588df2ea4a643bf14000f2dfc672d8a7be732de  snyk-iac-test_0.53.0_Windows_x86_64.exe
0a915fdaffb003d7595efe0e14f65813ea09d01d9425d8546b8a12ec81602088  snyk-iac-test_0.53.0_Linux_x86_64
11106c5317f324538fa6881b254885bfe02f0efc30213415887e9224fc38ec9d  snyk-iac-test_0.53.0_Darwin_x86_64
3d286b4328e54387311f317ad3055b0ebb8dbcbc2e3694996699d15da8b8cbd3  snyk-iac-test_0.53.0_Linux_arm64
47e364f3889ee8cee588045190b457b817b5d391d74978dbb5ab23e9e5e79c46  snyk-iac-test_0.53.0_Darwin_arm64
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
