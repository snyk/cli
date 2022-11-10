import * as os from 'os';

const policyEngineChecksums = `
13915c842de8688ea460f86f63892d36bb2991467ddbf3328d6e5b1e2891a459  snyk-iac-test_0.36.3_Darwin_x86_64
2b15712d1b14ad52e4377e509671c5df69382f8bfd97369e40394e5c2dc050e3  snyk-iac-test_0.36.3_Linux_x86_64
67201ed6b2e2037947155ca2bc7e7bbdc09b84ba9ad46bd591fd316ec674a154  snyk-iac-test_0.36.3_Linux_arm64
9423a27525d131f0749b473575bac753b53e0be541035ac138eda957af28c341  snyk-iac-test_0.36.3_Windows_arm64.exe
d7437c82103cb07e2c6a1cfa3ff6efe9b0d1d6f675ea464a11061d2f2627fa3e  snyk-iac-test_0.36.3_Darwin_arm64
f9df780f1864fbd76857d4c28fafd1c793c62bdad48e3d084db94812c6f53f9c  snyk-iac-test_0.36.3_Windows_x86_64.exe
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
