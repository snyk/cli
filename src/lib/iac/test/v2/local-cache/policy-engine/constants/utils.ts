import * as os from 'os';

const policyEngineChecksums = `
06d2be54377f114e4feff12c5d5ea7daff68e49fc409e6b7ab4d2803e4e24dd9  snyk-iac-test_0.37.2_Darwin_arm64
0f8f4c2eca812362e2fcb4a004ac8c06abfa3460b05d24544b8f240a5c464e10  snyk-iac-test_0.37.2_Linux_arm64
8f7f1e3e71bcd55516c812b87fd691352dd857e7150aa1613e952ca4bedfa771  snyk-iac-test_0.37.2_Darwin_x86_64
c359f8b5a28303c3040806f59cc3dbeaaa46cb70e4d927887f3c8751eea1163d  snyk-iac-test_0.37.2_Linux_x86_64
cbaecf17c5a6d8ae3b1e5bfc733ca77fa6952d3ca685a7fa98c29389355df06d  snyk-iac-test_0.37.2_Windows_arm64.exe
cc1fa53f3cc0759f5a7829068a67cca313e3157a933f9e9d501856724b9e6384  snyk-iac-test_0.37.2_Windows_x86_64.exe
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
