import * as os from 'os';

const policyEngineChecksums = `
a09ab6b2a225ab52a4d5e03ca7c572f54765ef9832146fa02b262d98829ad733  snyk-iac-test_0.40.4_Darwin_arm64
ceb038fbf466cba9f35c0fd78d32c21826202330c8878ea7c401e4fa700c296c  snyk-iac-test_0.40.4_Darwin_x86_64
a408ec25b6d9fd245f037d7bc2b2b6c706652d4d917ca01812732804f03575e0  snyk-iac-test_0.40.4_Linux_arm64
df77d6ce46f242402dbc72dc7115dcca70729bbb48729bd0dab7fec7369bfedd  snyk-iac-test_0.40.4_Linux_x86_64
434784b5c9d8442a9341b57a16c94a5aef55bca5a4d89c2972e80c07b13a6e2a  snyk-iac-test_0.40.4_Windows_arm64.exe
0cf599d63335c99b5979e03fee93d55dc6236a194439146360107856aa2b3f36  snyk-iac-test_0.40.4_Windows_x86_64.exe
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
