import * as os from 'os';

const policyEngineChecksums = `20c1531abe769c623106d72158c7008904abbf5e9434c3e13ad1bbd0142c485b  snyk-iac-test_0.24.0_Windows_x86_64.exe
3bc449f592a51e0cb3e1d7c8c4eeae8f65a6ffca3cbe1466ecb58e89138bf075  snyk-iac-test_0.24.0_Linux_x86_64
9efe44502e92a7b6011ab133349a1d59575773c78c5154642cb4b687aad5fa7e  snyk-iac-test_0.24.0_Darwin_x86_64
a0f577d1169532fa1056f5502e7481522520fc6259ce12f9d2877b87b4269bb0  snyk-iac-test_0.24.0_Windows_arm64.exe
f519daf0bd505865a94ba37079f1109dd0177d645bf07c0bd5ceb1288da18b0c  snyk-iac-test_0.24.0_Linux_arm64
f6039356de00a6075714f8d703b4120fb41f8f6ada836f32fdb40d22a89230f2  snyk-iac-test_0.24.0_Darwin_arm64
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
