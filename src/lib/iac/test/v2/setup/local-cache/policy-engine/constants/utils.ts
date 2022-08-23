import * as os from 'os';

const policyEngineChecksums = `0313de2afa00ed6301e8cadbe344e448085c6e94cb0e87a06264b908c3c5e2de  snyk-iac-test_0.22.0_Windows_x86_64.exe
031416e2714ba2bfe85bb294f588eebc20b028dae2222b1929df2072fd01028d  snyk-iac-test_0.22.0_Windows_arm64.exe
03dcc3b16f1d84f80346aaf05fe7f8a5f8099af765c9979e8f36ee4b9cee4fb3  snyk-iac-test_0.22.0_Darwin_x86_64
54d0a20a209c45f948f147e4280650b366b4f8252b042fe4a30bec832fe3f915  snyk-iac-test_0.22.0_Darwin_arm64
cb0d714746310cda42914163572e39c4e4f044342d54695ac901d80e03c9ecf8  snyk-iac-test_0.22.0_Linux_x86_64
f95568949342bf7f33285500022a9ee0f3d64fc6dd601f16ce9b654e43cb6de6  snyk-iac-test_0.22.0_Linux_arm64
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
