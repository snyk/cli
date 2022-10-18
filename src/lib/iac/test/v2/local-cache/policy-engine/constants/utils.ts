import * as os from 'os';

const policyEngineChecksums = `
01cd66d6d7f18fb3fa191dd5acf948c17951176464eec77a391794b365f55e2d  snyk-iac-test_0.34.0_Linux_x86_64
0e1c3d9a961b5fbb701449fc7b4640d598831997b259ab99ff7ce53a8e792aa4  snyk-iac-test_0.34.0_Windows_arm64.exe
74a23e9fd003f69687cb3aedf7124a51a77011710a9b3d7ff78eb8f80f6c749a  snyk-iac-test_0.34.0_Linux_arm64
7a5ef250f9cc70b403ee8e7a1a5c471835712b097119e170ee3b6edf8ecaac71  snyk-iac-test_0.34.0_Windows_x86_64.exe
820ee51cf1511cf61f42be4bbfed5c9d0bcf630f573ba2626312bfcb2b1f1520  snyk-iac-test_0.34.0_Darwin_x86_64
eb015f6e79c3ee30b3ce536b2f024a361019aef3d939149d3e7e143710328174  snyk-iac-test_0.34.0_Darwin_arm64
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
