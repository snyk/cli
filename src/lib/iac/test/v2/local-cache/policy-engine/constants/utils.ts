import * as os from 'os';

const policyEngineChecksums = `0cbcdc8f4a7652835355f010d5cb97597055577e624799428c62819d74773b7e  snyk-iac-test_0.28.0_Windows_arm64.exe
28637249844c060dc950c6d3fdb31e1ff2d96bfe76291fb383d5c94ee2db7b26  snyk-iac-test_0.28.0_Linux_x86_64
45629e08ff8c3bfc601773d38705c19ea3abc2b8c33ee7174c97eb5669aa73f9  snyk-iac-test_0.28.0_Linux_arm64
5a5066edc9dc8daf61fe57f57e844cff59c91c0fdb70f3efda3fe8260f06e801  snyk-iac-test_0.28.0_Windows_x86_64.exe
db669ad313d222184e07c02f3540b06c62de283ef2e57a75ee1df4116f1831a3  snyk-iac-test_0.28.0_Darwin_x86_64
eb0b99c469eb31f930852466bb1e8b9e576a0bf22ea17dc951762f824009c18a  snyk-iac-test_0.28.0_Darwin_arm64
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
