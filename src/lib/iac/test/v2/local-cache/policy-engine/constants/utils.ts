import * as os from 'os';

const policyEngineChecksums = `
25baf500970fdf5cc6ea928ee264e808cb7d6ed5d3ccd6e1e7a92e93af3594d0  snyk-iac-test_0.36.4_Linux_x86_64
3726dccf754f99ff5e0c69bf8a708b35af0a870ce76f08491ee1a45641fe5cc3  snyk-iac-test_0.36.4_Darwin_x86_64
4f40636482ec687fcd5c3db93d2f1c651fc9be2c5c56aae1c948e30212a25dd3  snyk-iac-test_0.36.4_Windows_x86_64.exe
5864ce66aacb2a534fec6908e3c563a750d509b418ba72beb43c855ac171aef3  snyk-iac-test_0.36.4_Windows_arm64.exe
b6ae9bf636e950ba222bb17d5064e24a18839a08fddf5ad95d9541325c4bfdb3  snyk-iac-test_0.36.4_Linux_arm64
eaf35b10002c937b565918e2e0a1fa4cd9fb9e62441605955e3b6afe461ca875  snyk-iac-test_0.36.4_Darwin_arm64
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
