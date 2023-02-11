import * as os from 'os';

const policyEngineChecksums = `
0e505b9284ff31465a50656006a9fbbca943988e3dc1a2860ee0ab3e6b2573bc  snyk-iac-test_0.39.0_Windows_arm64.exe
566d8587057312ecbe8298ad0acf712904689e332652c43c6bd0a499d677a44c  snyk-iac-test_0.39.0_Darwin_arm64
7258a935fc08634a47f0c111400664cb9ff176f1cda67131891421f78bce115c  snyk-iac-test_0.39.0_Linux_arm64
b172acbb0a84f40a9917f196e1f7b4d1aa21feddc1b2f1670ed6ef9dc71fb2e4  snyk-iac-test_0.39.0_Linux_x86_64
c3f38885ba20087ecf20587dd83ebc4f9df27438cd9d9281700cd670877f3144  snyk-iac-test_0.39.0_Windows_x86_64.exe
e1286f48b4bd297c05a52d256ddc4487d7c10a0e48298a177c43f3825ef83944  snyk-iac-test_0.39.0_Darwin_x86_64
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
