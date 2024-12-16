import * as os from 'os';

const policyEngineChecksums = `
0cdd258f3763ff665cf55f05dccba5f2e40cfec2af72cd2e07a6132d7d9df8ec  snyk-iac-test_0.57.2_Windows_x86_64.exe
28491503681c1a8f0857c8b99c8f6f5fbedad5a9da2273b641d1ed37438b8563  snyk-iac-test_0.57.2_Darwin_arm64
3a0ecaba0cb859161ab8630b82be76341016a63a160b2054c9552103e72370f6  snyk-iac-test_0.57.2_Linux_arm64
59077f8109e18061b177876af0290906fbfc04494de3ac24ab4a22629f35fb8b  snyk-iac-test_0.57.2_Linux_x86_64
ac80bd7989229680ffda0b80ab6dcc736c9b68e31326be49dcf920dbe67f6c07  snyk-iac-test_0.57.2_Darwin_x86_64
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
