import * as os from 'os';

const policyEngineChecksums = `
0678a0e62acdc567bd5fcee5f6ce59420cf8c70f3082c98cec653d36d86a6c0e  snyk-iac-test_0.50.3_Darwin_x86_64
69bab03c97735f01c833135c71861dec2afcc2e42fe95a75fe7d7f41399a4144  snyk-iac-test_0.50.3_Windows_x86_64.exe
764eb0f5e722f9ef5a9951e1e2e314c9b49a77cb7a57aa2e03c0c5799825d8cf  snyk-iac-test_0.50.3_Linux_arm64
c10e9971285a33736377d8c85890e24a728bbaf1caeccc4bc49d633c25f5e61c  snyk-iac-test_0.50.3_Darwin_arm64
c60fec5fcfc876378ccf217b0aae1e6564b8e93ac35efcde9d7f61e9f587c87d  snyk-iac-test_0.50.3_Linux_x86_64
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
