import * as os from 'os';

const policyEngineChecksums = `
269ba8671e12b0a0b103d7f77cdfc587b5543270cbda116defb9cdb00d9d6cf0  snyk-iac-test_0.17.3_Darwin_x86_64
2768d899c9e44d515d4ec9c88ececaeee588817fa1a0502c0034c412e79f39a0  snyk-iac-test_0.17.3_Windows_arm64.exe
29aa2f407d7792cf9abfda3b9ee73721a3f32d1d18d14cf07f8edd32e88e98ee  snyk-iac-test_0.17.3_Linux_arm64
7285a310ab4d6b341d78ac94ec4cd8b58c72672e151874de7c7a64bcbddbbed3  snyk-iac-test_0.17.3_Darwin_arm64
85ed199a2fb2f94f3969f04e476161b451066af5b6a75818cb9e5b447c20814f  snyk-iac-test_0.17.3_Linux_x86_64
91ce1ea3acbcb03b3e6f39ef0aedce43e10bb592f22df2a88a7e506b687d123d  snyk-iac-test_0.17.3_Windows_x86_64.exe
`;

export const policyEngineVersion = getPolicyEngineVersion();

export function formatPolicyEngineFileName(releaseVersion: string) {
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
