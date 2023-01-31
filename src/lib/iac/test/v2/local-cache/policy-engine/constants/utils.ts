import * as os from 'os';

const policyEngineChecksums = `
34017ece0694455298143039885cb2543bff40449e213031e5f2ea33931a8256  snyk-iac-test_0.38.0_Linux_x86_64
3607e6fdeec1a132e33d3c5e80a64c9be41ee30878a5022208dd6c402a48cc98  snyk-iac-test_0.38.0_Windows_x86_64.exe
524e6db2d2f8055f28a2acd962d9fd07a0489ae670f5235cdcd457d48560e039  snyk-iac-test_0.38.0_Windows_arm64.exe
6d85080cec607f560ba0f0c0eaf495da893ee8e77c7b2ecc90cfde350a7da228  snyk-iac-test_0.38.0_Linux_arm64
738e68fff6b62496114c48847236d1435e8c2727bd94f80ea719c917e494fe31  snyk-iac-test_0.38.0_Darwin_arm64
7ace4fd38078e1af928b61b2b5f2c2ceb0a6536a94f3aa651f17fbaae9d32dab  snyk-iac-test_0.38.0_Darwin_x86_64
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
