import * as os from 'os';

const policyEngineChecksums = `
124b8f9225a4ed5c244e7e1991ed26448ea8e35413a9e265cb5c4185f9af9538  snyk-iac-test_0.57.0_Darwin_x86_64
26ae8c3cc8cc4d8a7fa5f3c0a94a9c30b043bc2c3f1c19582d5f3c4879b056c4  snyk-iac-test_0.57.0_Linux_x86_64
9a1e25084d7ff064568f4b14ad6808e9fdee5711fbbbe3e618b51b3d5962d2cc  snyk-iac-test_0.57.0_Windows_x86_64.exe
f2e569723e9b60cbcc02de92b9b65e15d59896d0f6bfe4de72f44c09b7fb5a95  snyk-iac-test_0.57.0_Darwin_arm64
fe6c6f56c4acf15575c407d6fcb7e33e36f301f29f6256fdf22c9cfd7eae5cc2  snyk-iac-test_0.57.0_Linux_arm64
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
