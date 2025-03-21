import * as os from 'os';

const policyEngineChecksums = `
133c5a025bfdb1495f2941ad85f6ba0b74e142464e970c85004b9f287a439ad5  snyk-iac-test_0.57.9_Windows_x86_64.exe
62d727c7d353142707a81258fea04fda76a718f7da618704166dc5347b21b022  snyk-iac-test_0.57.9_Linux_x86_64
ca7f470776adc0eb26d0e19e3a12f5bc354513612318bd6669679fd0c3d5ce55  snyk-iac-test_0.57.9_Darwin_arm64
f8b86cfb397e98c2ed6978f53f70a8becb99fc9f4a6381365beeec7b648b1091  snyk-iac-test_0.57.9_Darwin_x86_64
fca3e40c31232f72f640f7f3623e1d9252db65588d92061e2dba34e8f9bee02e  snyk-iac-test_0.57.9_Linux_arm64
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
