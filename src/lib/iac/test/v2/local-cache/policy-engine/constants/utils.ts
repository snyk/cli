import * as os from 'os';

// TODO: update!
const policyEngineChecksums = `
2a4abd57e799bc083ca6dfbbee46bfba0dda3b0f998add03292cf3ded7fa7393  snyk-iac-test_0.47.1_Windows_x86_64.exe
2b7bbaae7c7220ae8aac141aae4c7833b978398505ad33c5bfab8ecacfd66940  snyk-iac-test_0.47.1_Linux_x86_64
8468636a35b6b40cbc1c5dfc39f31a811394b96833d98aef7aa3705ac817448f  snyk-iac-test_0.47.1_Darwin_x86_64
95625d1664427d4947ec34be0d48fb4d7442ec481187d5ba32ea1f2ddc40753b  snyk-iac-test_0.47.1_Darwin_arm64
a252789d8111b5f1dc280ef77f70aa6e1fbfd2fdc8149312ffac4948faf36b12  snyk-iac-test_0.47.1_Linux_arm64
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
