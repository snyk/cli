import * as os from 'os';

const policyEngineChecksums = `005afd663b57bc2981943496c2abb15f592df0c8a1022340c03c36c728d42366  snyk-iac-test_0.24.2_Darwin_x86_64
2ac72979d98ef2eaa8cc6a9fabe5b871bc87f1778c79ed3fffb704d3e6d41248  snyk-iac-test_0.24.2_Windows_arm64.exe
539d34c1b6af5b18d266e881a5612e6030ac6deae8a9172f6b198c5e27d57004  snyk-iac-test_0.24.2_Darwin_arm64
c91c105e2269fd1bf76eee5221f3046972febc6f803a70a52454b8d181760a96  snyk-iac-test_0.24.2_Linux_arm64
fbe724a3285d8dee7a70a8aedb539e998e368c6accafc9c3ce952b5ae0dca84d  snyk-iac-test_0.24.2_Windows_x86_64.exe
ff9fee0711c0556cf0f58469ef5c6db164825e855c29dfb404dfcd6cb338faed  snyk-iac-test_0.24.2_Linux_x86_64
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
