import * as os from 'os';

const policyEngineChecksums = `0f27f5068f0984000cccffb6826d338cd65f1b5ec3229aad0ba59e9c97babf72  snyk-iac-test_0.18.1_Windows_arm64.exe
122274110bce6bba12f04091672b0269a12824c17361765b76d3020c88209524  snyk-iac-test_0.18.1_Linux_arm64
92d9e69445f67005a8828f83b6235fa7d7276042c832ac92cff0c5189712fa97  snyk-iac-test_0.18.1_Windows_x86_64.exe
d683f8e3030d60115cadd33d11b851de0d0794e7b3e061bdace6d6cea6877b56  snyk-iac-test_0.18.1_Linux_x86_64
fa17535d946e75031e30b655672fcb232ea2272871cdd9b9f7a14313ee3a7225  snyk-iac-test_0.18.1_Darwin_arm64
fbef8749657fbe93818fa98504bbf66225bbbd153837d8a4dc7fb5f77fc04975  snyk-iac-test_0.18.1_Darwin_x86_64
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
