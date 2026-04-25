import * as os from 'os';

const policyEngineChecksums = `
1334e0dd61975f2a90d7f4c7612288b2e3cb6658b23c269bdd2c5a19f960a9c8  snyk-iac-test_0.57.11_Darwin_x86_64
2c8dbad1190c1794b27772967a908c362c1fdcd0b6fd76a9b9a9b40d9b45eaf7  snyk-iac-test_0.57.11_Darwin_arm64
47f12ea5072a89d54369a50bdb81384c39db08ec0b4f7f6e2bda120ddcf509f4  snyk-iac-test_0.57.11_Linux_arm64
996f759a52806988f3c37a3c78de07df8828609b37c4371ad66f4be40303445b  snyk-iac-test_0.57.11_Linux_x86_64
9dd0042026af42c9b3761f2b2ada9584f8ff7f8b2e5f7b03c56fb3b00652fdb4  snyk-iac-test_0.57.11_Windows_x86_64.exe
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
