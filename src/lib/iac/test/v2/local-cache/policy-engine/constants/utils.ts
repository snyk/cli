import * as os from 'os';

const policyEngineChecksums = `
13d050f87c13647f9e39b39ebcfecb01e1f42e079208e228568a68769f3c368b  snyk-iac-test_0.45.1_Windows_arm64.exe
191b9a97d40f8755e7c3b0a0cd7583c29b4c94091d9a0d6f8b9702acc2759099  snyk-iac-test_0.45.1_Darwin_arm64
4d5f1e90d6f08e6c9927eca4a8470788af57f855208f987c509e212cb14e2801  snyk-iac-test_0.45.1_Darwin_x86_64
6eb724a08c8f4609168d1ef2c82a03a30fd9d5647833a91ab07c7ec881d53bf3  snyk-iac-test_0.45.1_Linux_arm64
9fee9e4a271cfd254c56cf7ab6347ca86b97db29f89a6d175cf3ea80b8ec53b8  snyk-iac-test_0.45.1_Windows_x86_64.exe
d63f070c94d1ea2c1758c881da5ad43043d4e38ce14aed2af686fef951b2150a  snyk-iac-test_0.45.1_Linux_x86_64
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
