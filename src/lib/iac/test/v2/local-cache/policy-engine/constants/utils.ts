import * as os from 'os';

const policyEngineChecksums = `
10fe8309271214633738016c919fe6de9182f8a4008e0af96091a15cd9f7e8fe  snyk-iac-test_0.36.5_Linux_x86_64
34a2be18455a50f5ced20531a68855b20e63614f73a24370fea8f2bb72e8ee70  snyk-iac-test_0.36.5_Linux_arm64
3bb311926b5466a0879df006a09e60edaed5edfd52b6ff85ef90b714c7d0d41a  snyk-iac-test_0.36.5_Windows_x86_64.exe
4a2b2311c49e6f4390f315f4a18c4271b73d7a5fdde384d14047d5c18e656e8b  snyk-iac-test_0.36.5_Darwin_x86_64
4a5e990b47330fd12e76cacb13691d76e30d01717aab88797570b46ad2e3d5a6  snyk-iac-test_0.36.5_Darwin_arm64
c4fd7fc40b3aa18248dfd2cd230d13ce749da20423b568b1b5ecd143b2f18d2e  snyk-iac-test_0.36.5_Windows_arm64.exe
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
