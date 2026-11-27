import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scan } from '../../../../../../../../src/lib/iac/test/v2/scan';
import { TestConfig } from '../../../../../../../../src/lib/iac/test/v2/types';

describe('scan', () => {
  const tmpEnvVars = ['TMPDIR', 'TMP', 'TEMP'];
  let originalEnv: Record<string, string | undefined>;
  let isolatedTmpDir: string;

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      tmpEnvVars.map((name) => [name, process.env[name]]),
    );
    isolatedTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iac-scan-spec-'));
    for (const name of tmpEnvVars) {
      process.env[name] = isolatedTmpDir;
    }
  });

  afterEach(() => {
    for (const name of tmpEnvVars) {
      if (originalEnv[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalEnv[name];
      }
    }
    fs.rmSync(isolatedTmpDir, { recursive: true, force: true });
  });

  it('removes its temporary directory when the scan fails', async () => {
    const options: TestConfig = {
      paths: [],
      iacCachePath: isolatedTmpDir,
      report: false,
      scan: 'resource-changes',
      policy: '# Snyk (https://snyk.io) policy file',
    };
    const missingPolicyEngine = path.join(isolatedTmpDir, 'no-such-engine');

    await expect(
      scan(options, missingPolicyEngine, 'bundle.tar.gz', 'http://localhost'),
    ).rejects.toThrow('spawning process');

    expect(fs.readdirSync(isolatedTmpDir)).toEqual([]);
  });
});
