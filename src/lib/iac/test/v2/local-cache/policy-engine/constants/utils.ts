import * as os from 'os';

const policyEngineChecksums = `
2ae37310b47c48eb10c90ba18478197e1803f920ea7a21c2b924823ed9ab37ef  snyk-iac-test_0.35.0_Darwin_arm64
6a1f9bf454780d598e7ebbba2752d94da7bea7ced4e9de644c3e0d72a0c3911e  snyk-iac-test_0.35.0_Windows_x86_64.exe
83314c1d0a216918d8c6d4245247d10eded9e6b56e0cc2b0586445289a292772  snyk-iac-test_0.35.0_Linux_x86_64
e2cf8da6bd1f312504510b48d0e3f1198fa5c4a754a6aadbe1d9b6010bb187d8  snyk-iac-test_0.35.0_Windows_arm64.exe
f59caeb9320b1da49f9feb4aa5389b18e195106a04b438a0a996d1a3fc98e065  snyk-iac-test_0.35.0_Linux_arm64
faf8eda29e5738f54bdd4d44861ec6aa5f7312a284889c39c1e59780d95e0488  snyk-iac-test_0.35.0_Darwin_x86_64
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
