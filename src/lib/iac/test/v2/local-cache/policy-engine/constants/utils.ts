import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
04ada5a961579d4de9798704d615dbbda25d18a2722ae5de1b2d610f02d56cf6  snyk-iac-test_0.48.4_Darwin_arm64
5bde682ac614816853012d2653a4c5cca62b3bed0a4dabf55933b793080b2304  snyk-iac-test_0.48.4_Linux_arm64
d7d8c4bc270e414f1e562b47554d9dee631fb7d4b7334142b68645a32d237573  snyk-iac-test_0.48.4_Linux_x86_64
dc77d7e9a796fb31b03f15f15e5ecdfc7f68cc836b74195c1634840cec141388  snyk-iac-test_0.48.4_Darwin_x86_64
fa3a75501b4ce3e21705ba4faad494999e0c2d5686cc86e8b3e549220e8fbff3  snyk-iac-test_0.48.4_Windows_x86_64.exe
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
