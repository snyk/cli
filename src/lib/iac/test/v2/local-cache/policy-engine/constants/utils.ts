import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
255a687bd2e5e6e6426ec3a6f45692b2005760a17a07c1ad793c47bbc0ba3c06  snyk-iac-test_0.48.1_Linux_arm64
36819fafec6ed17a2428f184d89fd210662e5382570f05540177e715c7797d60  snyk-iac-test_0.48.1_Darwin_arm64
3e7c2640790ef1c46c5df4c7b77c921b56e3f74c22dceeb7725fb486e3791e0f  snyk-iac-test_0.48.1_Linux_x86_64
586ecba78dc8a788a5f94db4d42b53bea1d7a1e0e4792d592013a457e7f8d05d  snyk-iac-test_0.48.1_Windows_x86_64.exe
9aa14f8f8136cf5000a622e5f7c60f66da031d793cac10440edc22adda59f388  snyk-iac-test_0.48.1_Darwin_x86_64
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
