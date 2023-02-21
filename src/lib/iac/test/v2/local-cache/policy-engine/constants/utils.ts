import * as os from 'os';

const policyEngineChecksums = `
2cc88f4f928d47ec914d6ab40c773ce3efef18a879db1c702df0500e250666fa  snyk-iac-test_0.40.3_Darwin_arm64
987a9bb850739c727dff6f47f0daa673489ca2bf0ae87ca253c7a4c66ce81285  snyk-iac-test_0.40.3_Darwin_x86_64
ff9e2dfaca90f0efe270cffc843a25252dec266d8ba3307babf70af4d28509e6  snyk-iac-test_0.40.3_Linux_arm64
0b516c5a25aa23950646b314d182236106ea984322837aa17e928dd9f24a0103  snyk-iac-test_0.40.3_Linux_x86_64
505f9371d0a5cc874ae979127b8d5690bd4ddc6c38046dcb43d091ce67c4978e  snyk-iac-test_0.40.3_Windows_arm64.exe
62dbb08941b6d520ba68a1ab1aa804b1797133dc4f91560a4762e9510d14292b  snyk-iac-test_0.40.3_Windows_x86_64.exe
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
