import * as os from 'os';

const policyEngineChecksums = `
26bca97d616c7a24500e0c97836660677ce6a6a50e7b2219732eada3312e9136  snyk-iac-test_0.57.6_Darwin_arm64
28c43426ca7e1ee54aa3d44e6f80436b4030016df91dd0dbfb3a37d09fa73fb3  snyk-iac-test_0.57.6_Linux_x86_64
39f7674101787c13fc66a54edd378f5a9e955ff7e8705788691cd8d249fc02dd  snyk-iac-test_0.57.6_Linux_arm64
9ebd0ced0bd8c850e2c673930b111e28d3f6646fda6f2b4f7062c545ad22158e  snyk-iac-test_0.57.6_Windows_x86_64.exe
a64122a547bf41c1c834bcb97cb6da68f235fdd4e1b8ef60797d9745359dca45  snyk-iac-test_0.57.6_Darwin_x86_64
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
