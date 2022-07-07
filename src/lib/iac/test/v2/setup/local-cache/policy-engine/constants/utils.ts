import * as os from 'os';

export function formatPolicyEngineFileName(releaseVersion: string) {
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

// this const is not placed in `index.ts` to avoid circular dependencies
const policyEngineChecksums = `17c96fae83c7b7bd287999c3272303045a38051686ac60880c1b3e484773c10d  snyk-iac-test_0.4.2_Linux_x86_64
1afa95542cfd7c32120b724886fa50d90fc10e186ed10a9cb96242d2dbcb9ace  snyk-iac-test_0.4.2_Windows_x86_64.exe
1f34e0a099ec4af17b20d7a28f981a0b85902d5f13b315709a66614969d917f0  snyk-iac-test_0.4.2_Linux_arm64
2340fefd5d389c2d91859aa0251d3dbfa738a1c5de02f6787029f37841c50421  snyk-iac-test_0.4.2_Darwin_arm64
ec28b5cccd1d9066a5b341c979e465e2a6691339cb1fcc7d5ce3dece0e9fb8f9  snyk-iac-test_0.4.2_Windows_arm64.exe
f3e54c7e105761851d2de578a6d39a8510af31ed4fbd91cf57162d7b4601f364  snyk-iac-test_0.4.2_Darwin_x86_64
`;

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
