import * as os from 'os';

const policyEngineChecksums = `
2c5220d327e7cf32e28c32ef7d4e9b7c6034c74111d0b3b192380a5b9db58afc  snyk-iac-test_0.35.4_Windows_arm64.exe
563904e44fa7722da56a5872d131f08b5dac531a9f18682f7fc8e028328c8346  snyk-iac-test_0.35.4_Linux_arm64
b22627f90d9798944e0a6d41c7a792c58162c60072fd76fdff2d902b8d8725ed  snyk-iac-test_0.35.4_Darwin_arm64
bfd2e47dc88b21d2fa77d2af750358f07556b1fcbe47ef3f14fedc4684e79617  snyk-iac-test_0.35.4_Darwin_x86_64
d31c468861c66695ec4623a9d04d9bcd39138b99298ac72cc7de14dc38f9bcfa  snyk-iac-test_0.35.4_Linux_x86_64
f9d6ba6188988a52f33bdb9dde84161d0a4d2af49833181687f15d953d8f715e  snyk-iac-test_0.35.4_Windows_x86_64.exe
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
