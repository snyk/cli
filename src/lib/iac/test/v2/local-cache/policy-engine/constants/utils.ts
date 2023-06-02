import * as os from 'os';

const policyEngineChecksums = `
14b1b45e2cac3a57da0d8624d525fd384b7773fbc7538f0ca63f48582e8693b6  snyk-iac-test_0.45.0_Windows_arm64.exe
44bc84d0c930522e6c229d14f54ca3a733c409ba91d322a30a3e6210d0417098  snyk-iac-test_0.45.0_Linux_arm64
89ff65a595aac825844a25d47852389552ab5de77fc0329f19656c047a6eb939  snyk-iac-test_0.45.0_Linux_x86_64
9a2439fc8225113d926b325b77c3c0569279f6e3eaf48bcf44e23d442411b92c  snyk-iac-test_0.45.0_Darwin_arm64
d2582f9bcc9ec48ca7a52fe1abaabe1039959c596060152737218579f9fe6924  snyk-iac-test_0.45.0_Darwin_x86_64
da3dc1bd10c8d86d81053b7934a76f0e556966a8ea79561cb3bbfdb426b7b01e  snyk-iac-test_0.45.0_Windows_x86_64.exe
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
