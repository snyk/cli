import * as os from 'os';

const policyEngineChecksums = `
5152d4bc7a8f5f1a7bfdd198b6bb5b82a1d2c66555fdc657f62069a00cc993fe  snyk-iac-test_0.50.4_Linux_x86_64
59ea910aac234e7ce563078b54ef721adf795a9bc6348183028374662ab35ec9  snyk-iac-test_0.50.4_Windows_x86_64.exe
5a7136b0dc8b8ee40bf61ab101fb5689d18cf9476521a6a16ed939ad62a6d695  snyk-iac-test_0.50.4_Darwin_x86_64
87657782a31f66897dd568303b38862d3587589bc12601adfbbdcbd688818814  snyk-iac-test_0.50.4_Linux_arm64
a7150de35ab607163343ce287eac7cfe8b9a904843837ea643c188d0406a3e2f  snyk-iac-test_0.50.4_Darwin_arm64
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
