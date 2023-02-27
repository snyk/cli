import * as os from 'os';

const policyEngineChecksums = `
622d8f5810be402f15a89e5f065ae3372fbc384aa14689d127b52e6e7febb0aa  snyk-iac-test_0.40.2_Windows_x86_64.exe
677c75adf5a92adff28ecbc26398c1c73575546028d3f3aad53f05d5b9a8f37c  snyk-iac-test_0.40.2_Windows_arm64.exe
6fd7d5f80ac0e7f03787d379102321b16a8a9267c9e64414a06a55b94839c48f  snyk-iac-test_0.40.2_Darwin_x86_64
9b4ef2012f3555ad1daf58cab006aae38c282c3fcb50b87a0febc2cef0176a7b  snyk-iac-test_0.40.2_Linux_x86_64
ba50d417833dd368eecb77fe6ce6bb8a7b6265f0ace5d265e27d4a109864b0c9  snyk-iac-test_0.40.2_Linux_arm64
fac925e5f9ccd386dc9109104a9dbad223f812e3bbc4e50e9b98bf71f5e4a040  snyk-iac-test_0.40.2_Darwin_arm64
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
