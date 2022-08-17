import * as os from 'os';

const policyEngineChecksums = `4f86b8133caa3e27410c853a910a41551a92de3c6402891fc22d8306185a170a  snyk-iac-test_0.21.1_Windows_arm64.exe
58b617385dcb1f7da100c1c04e50260d98dbee6811eda9575fc0a41367f9222e  snyk-iac-test_0.21.1_Windows_x86_64.exe
6fdd0b0d944bc4986a061d1eec404c6ef5cc7cc5ce4d9a3755b3dd24aa89af57  snyk-iac-test_0.21.1_Darwin_x86_64
80dc9ab2b4b51df29d4a3edd994a394c1c62d6c1f2d364ce98e1b5365a05f855  snyk-iac-test_0.21.1_Linux_arm64
b06f169fc03f6e6c3c7047c9270c6b7b20496070122ed3babeedd7e568c98009  snyk-iac-test_0.21.1_Linux_x86_64
c98a06db1bafa683cc479ecf77e7191eb94ece82dfdf9c229ac7258e73094f10  snyk-iac-test_0.21.1_Darwin_arm64
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
