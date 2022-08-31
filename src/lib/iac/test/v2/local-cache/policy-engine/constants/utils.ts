import * as os from 'os';

const policyEngineChecksums = `104f3a8d8d1835f9621007fb7976a837ee8946510f41f7fc50323f728cebb21c  snyk-iac-test_0.26.0_Darwin_arm64
61bfc743d4392952eb7de3f3c4cdb6e0dfb4a491d0ca24d67c929fc3656d6c5f  snyk-iac-test_0.26.0_Linux_x86_64
73847b5bcc0f42cc8acd918f0dff97ee917a64ce84991785a8e6c46a6c4bc6f2  snyk-iac-test_0.26.0_Linux_arm64
ac9100c8a1314a22fe7db7df8faa7d6be0aa6ba986f2db172f727fe004a0853d  snyk-iac-test_0.26.0_Windows_x86_64.exe
ad2983ff583989608e259441de12b6871d9e9dcb994eb81214e9dbb14d3b3dd4  snyk-iac-test_0.26.0_Darwin_x86_64
c7de20ee54fd66c885e2bbe37b8c1d533464a525a5abdbc1d86a6a5c8a76b2b8  snyk-iac-test_0.26.0_Windows_arm64.exe
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
