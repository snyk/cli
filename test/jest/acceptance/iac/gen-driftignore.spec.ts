import { startMockServer } from './helpers';
import * as os from 'os';
import * as path from 'path';
import { getFixturePath } from '../../util/getFixturePath';
import * as fs from 'fs';
import * as uuid from 'uuid';
import * as rimraf from 'rimraf';

jest.setTimeout(50000);

describe('iac gen-driftignore', () => {
  let run: (
    cmd: string,
    env: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  let tmpFolderPath: string;
  let outputFile: string;
  beforeEach(() => {
    tmpFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dctl-'));
    outputFile = path.join(tmpFolderPath, uuid.v4());
  });
  afterEach(() => {
    rimraf.sync(tmpFolderPath);
  });

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('gen-driftignore fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac gen-driftignore --org=no-iac-drift-entitlements`,
      {},
    );

    expect(stdout).toMatch(
      'Command "gen-driftignore" is currently not supported for this org. To enable it, please contact snyk support.',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (os.platform() === 'win32') {
    return; // skip following tests
  }

  it('gen-driftignore successfully executed from SNYK_DRIFTCTL_PATH env var when org has the entitlement', async () => {
    const { stderr, exitCode } = await run(
      `snyk iac gen-driftignore --input=something.json --output=stdout --exclude-changed --exclude-missing --exclude-unmanaged`,
      {
        SNYK_FIXTURE_OUTPUT_PATH: outputFile,
        SNYK_DRIFTCTL_PATH: path.join(
          getFixturePath('iac'),
          'drift',
          'args-echo.sh',
        ),
      },
    );

    const output = fs.readFileSync(outputFile).toString();

    expect(output).toContain('DCTL_IS_SNYK=true');
    expect(output).toContain(
      'ARGS=gen-driftignore --no-version-check --input something.json --output stdout --exclude-changed --exclude-missing --exclude-unmanaged',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
  });
});
