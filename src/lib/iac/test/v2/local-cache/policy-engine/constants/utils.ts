import * as os from 'os';

const policyEngineChecksums = `
102442f1a622c4006207b5fb3822ea493000fe711beeb1341359f14057872b67  snyk-iac-test_0.54.0_Darwin_arm64
11cc1ed464380932cf46551a1a1eb8fbaea0cae2da0853b7dccbe58d872bc44e  snyk-iac-test_0.54.0_Linux_arm64
238cb88c2315d9bcca9a7f9a277934074f50902fdd595572cd739f4601b25ed1  snyk-iac-test_0.54.0_Linux_x86_64
487291b0193f3ed1a6647c631dfaa401faa81509d6c7fa328e1f29296115668b  snyk-iac-test_0.54.0_Darwin_x86_64
c94f91823e135c9e585bb41e5c274116001f079a28865a62e19ff9c8688a88e0  snyk-iac-test_0.54.0_Windows_x86_64.exe
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
