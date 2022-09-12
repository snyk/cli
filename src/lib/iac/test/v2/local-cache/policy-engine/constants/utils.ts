import * as os from 'os';

const policyEngineChecksums = `1ab888458215d8ba45452117854adb95060d9dac45f4b602e2e34f500b7b8a3a  snyk-iac-test_0.30.1_Linux_arm64
85e181989cde63797095107c38772edb4cba75a8becd82aad9c609b4c273789b  snyk-iac-test_0.30.1_Windows_arm64.exe
8e4bb3f55d6332706485f278d194f09ef08f46db5516b1008db9c152c636ae24  snyk-iac-test_0.30.1_Windows_x86_64.exe
ba478316de02fd69de4463edca221550d5f4eb962e514220b0a9d9a014d18128  snyk-iac-test_0.30.1_Darwin_arm64
f218a8e8cc25024f7936947c091e9c9ad34c33178cd6558bdda906fc47c1a598  snyk-iac-test_0.30.1_Darwin_x86_64
ff23fe190e2392ed4b42ee231171806c300bfe2b9983353497c9f1a195c5c499  snyk-iac-test_0.30.1_Linux_x86_64
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
