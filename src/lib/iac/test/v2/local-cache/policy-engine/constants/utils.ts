import * as os from 'os';

const policyEngineChecksums = `
44bc8c547e26f0960b95333a273fc6f7154f4919d51f2ee323c4133e29f322fc  snyk-iac-test_0.51.3_Linux_arm64
955d9416588379dff0ca128d4a26675a5e9575f6bd702fceeab58224f355d007  snyk-iac-test_0.51.3_Darwin_arm64
9bb87bff18af15fd50a1e518f78d649373a607a0a3d09e2d88c420649fae020f  snyk-iac-test_0.51.3_Windows_x86_64.exe
a2d91e709a8908a0df56fd0d05a029ecc75cbcfef6b2c5b80a621472a552952c  snyk-iac-test_0.51.3_Linux_x86_64
de5676c97e9f9080b2ebcc87bce2bcc9dc17961eadb81816489ea7130ab73ebc  snyk-iac-test_0.51.3_Darwin_x86_64
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
