import * as os from 'os';

const policyEngineChecksums = `
1784e3f36d6a13fe548cd5265eb40a6eb7989f1f29896325a8cef8cc44dd487c  snyk-iac-test_0.33.4_Linux_arm64
2f4d3bc0f0e28e93fb1e2ba93f78b959148b38fddd9bda1aea150660f2937f14  snyk-iac-test_0.33.4_Windows_x86_64.exe
7ddda2a45f3e887a11e0e17306f1c3d185f16c2dec7d066250bc5f5c1df462c0  snyk-iac-test_0.33.4_Darwin_arm64
9356ca2db4460c0fb0048c77eae75a82f11ef7edf857508db8d2e3e517be5cf7  snyk-iac-test_0.33.4_Darwin_x86_64
9b11f7b47e87b8877202964b911e3fced0d0ce17143d7f7b80aa4cc6055221fb  snyk-iac-test_0.33.4_Windows_arm64.exe
9df046112b2fcdec96f9539a3dcdadda2ec89cf74cfa3d9b3e3cb60921473f9a  snyk-iac-test_0.33.4_Linux_x86_64
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
