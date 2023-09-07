import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
3ec5e8ed0e17c8d3da4ef98b629b559669747982993c3e1037f14c448aa696a8  snyk-iac-test_0.49.0_Linux_x86_64
6be11cf55bf01a90622c397d31548ed6d50ac0f317f28c969e5cbfc109eae5e1  snyk-iac-test_0.49.0_Darwin_arm64
b965f0f672460920839efc5e889270facea5abc7d87eedb83b65277df6305b47  snyk-iac-test_0.49.0_Darwin_x86_64
e760a4e249fd950a89c4f996c59d20971263ba4f905d62880d05cc608718158a  snyk-iac-test_0.49.0_Windows_x86_64.exe
fb799eb5dd79a9d68f3deed9d4b5272e4e435fe31c348fef06e245790fe1069a  snyk-iac-test_0.49.0_Linux_arm64
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
