import * as os from 'os';

const policyEngineChecksums = `
01ef4ec71e610484be5ad84817bbfe6e529f9b8991c4fe7f7cb7bc462f7edd63  snyk-iac-test_0.37.3_Darwin_x86_64
498804bbc2a5006b294eb527aa49ba54ddddbe05e745dc6da6d53f596c0219ce  snyk-iac-test_0.37.3_Linux_arm64
6fe82db29b7e1dda53ac643f28966afd30cba1680b2de17799a480b8cf5c3884  snyk-iac-test_0.37.3_Windows_arm64.exe
789f5a235fa92b3043821a092219045b417027b06156123497a159c9ab1bda01  snyk-iac-test_0.37.3_Linux_x86_64
8e92610f459384a2d4268655cef5f11afe3baf7bf62c6733d2262deab7a2a10f  snyk-iac-test_0.37.3_Darwin_arm64
b5b174a14b8c8be1febdcf46a8f423db965530cf090c66ed51beecdc87ef507b  snyk-iac-test_0.37.3_Windows_x86_64.exe
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
