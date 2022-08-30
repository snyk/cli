import * as os from 'os';

const policyEngineChecksums = `2b96e44012ab42e6a181a954c83af374e1bbdcb0f39782504421730615dd8b0d  snyk-iac-test_0.25.0_Windows_arm64.exe
6ed11a2f3fed1a382a69e5ad47eed37951490688dc0d0ea31c15b81e6022a98c  snyk-iac-test_0.25.0_Linux_arm64
94cf0ffdb75108f826f2df2495f579c48e016f1fc5b63f25205f79a72523930d  snyk-iac-test_0.25.0_Windows_x86_64.exe
af7c9d6334cb6bc2af981a950035eeca755c26a366a7142e5b3774341104a80c  snyk-iac-test_0.25.0_Darwin_x86_64
e6f8838f419d8639b2358d84b134d0abd2cc6c855730db5ab27464f32911d8c2  snyk-iac-test_0.25.0_Darwin_arm64
e89838a2d41ebc90e4575558c09074044b3e2966494590fa13b31efe9ed3efc6  snyk-iac-test_0.25.0_Linux_x86_64
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
