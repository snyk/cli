import * as os from 'os';

const policyEngineChecksums = `
287c2b8c97b2b6208264e5bf9dab3132c34355efdecf29974a84bd56e7e1654d  snyk-iac-test_0.31.3_Darwin_x86_64
4cb497eac74ed543dde6935e5cc0519cffbcced6bfe9a98c697b125edfb75a2e  snyk-iac-test_0.31.3_Linux_arm64
6059e32181c32f364757cb39204beea73c1ed4c477d5ae8fa8e970d5c792bb37  snyk-iac-test_0.31.3_Darwin_arm64
7767548480f2479205bdf3d792a66d43313717a471e1c300841504b63ae2581b  snyk-iac-test_0.31.3_Windows_arm64.exe
8363ae002cf64f4bb0c65ddc2312d4c6b23098032983d61d8c4c439b705750ed  snyk-iac-test_0.31.3_Windows_x86_64.exe
e36cc18b60f7b41fccf5a097f685f437813b9183aa9c6fa97ea4c1fe36ac0e42  snyk-iac-test_0.31.3_Linux_x86_64
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
