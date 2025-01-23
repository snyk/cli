import * as os from 'os';

const policyEngineChecksums = `
aeb08fbecd094cdec741237f0f9f187492fa4e446f41e3dc7135426fdd721382  snyk-iac-test_0.57.4_Darwin_x86_64
b9607371e0372b382c6e92fdbe1624364baf3b2d4856312c32567de4ed0bdc72  snyk-iac-test_0.57.4_Darwin_arm64
c4447339c352c646bfa79bf12aef108e8c9f0263ac2440fe7e5edafa46ba433d  snyk-iac-test_0.57.4_Linux_arm64
fa327f0909b43b59bb76dfd54f99603859a2606663390aad16abe484f6ef8765  snyk-iac-test_0.57.4_Windows_x86_64.exe
fe0604529047aa5fcd3edffe5f1b9392bfc255f94885d745266aca768f521907  snyk-iac-test_0.57.4_Linux_x86_64
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
