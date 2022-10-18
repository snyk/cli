import * as os from 'os';

const policyEngineChecksums = `
289368b4e85d455c619b7f25e1680ca520e61f0bd727a02b55adeff85980ee57  snyk-iac-test_0.33.5_Linux_arm64
51092d8e7bb51a0b7323f5e8f072d9f6690e2cc81561eba0615e847f68f00731  snyk-iac-test_0.33.5_Linux_x86_64
6836d69eb527cf9ae8d87327278624ca3a487afff86da5a87c81d4a1a8785ce9  snyk-iac-test_0.33.5_Darwin_arm64
83740d8b61000b986a6092188897b98dbeea634c64840c8beaaf9199f7055b68  snyk-iac-test_0.33.5_Darwin_x86_64
bdc42a135e8319768841f56f0985722a7aabdc8c6259b9e426dc55efc37ecf61  snyk-iac-test_0.33.5_Windows_x86_64.exe
cb34a3e8aaddebe2e2ba01c62c042723f832c686626cad1e15e296b7a0c0106c  snyk-iac-test_0.33.5_Windows_arm64.exe
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
