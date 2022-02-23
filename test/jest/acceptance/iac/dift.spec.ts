import { startMockServer } from './helpers';
import envPaths from 'env-paths';
import { driftctlVersion } from '../../../../src/lib/iac/drift';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getFixturePath } from '../../util/getFixturePath';

const paths = envPaths('snyk');

jest.setTimeout(50000);

describe('iac drift scan', () => {
  let run: (
    cmd: string,
    env: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let apiUrl: string;

  beforeAll(async () => {
    ({ run, teardown, apiUrl } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('Fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac drift scan --org=no-iac-drift-entitlements`,
      {
        SNYK_DRIFTCTL_PATH: './iac/drift/args-echo',
      },
    );

    expect(stdout).toMatch(
      'Command "drift" is currently not supported for this org. To enable it, please contact snyk support.',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (os.platform() === 'win32') {
    return; // skip following tests
  }

  it('Launch driftctl from SNYK_DRIFTCTL_PATH env var when org has the entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk iac drift scan`, {
      SNYK_DRIFTCTL_PATH: path.join(
        getFixturePath('iac'),
        'drift',
        'args-echo',
      ),
    });

    expect(stdout).toMatch('scan --config-dir ' + paths.cache + ' --to aws+tf');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
  });

  it('Download and launch driftctl when executable is not found and org has the entitlement', async () => {
    const cachedir = path.join(os.tmpdir(), 'driftctl_download_' + Date.now());
    const { stdout, stderr, exitCode } = await run(`snyk iac drift scan`, {
      SNYK_DRIFTCTL_URL: apiUrl + '/download/driftctl',
      SNYK_CACHE_PATH: cachedir,
    });

    expect(stdout).toMatch('scan --config-dir ' + cachedir + ' --to aws+tf');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
    expect(
      fs.existsSync(path.join(cachedir, 'driftctl_' + driftctlVersion)),
    ).toBe(true);
  });
});

describe('iac drift gen-driftignore', () => {
  let run: (
    cmd: string,
    env: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('gen-driftignore fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac drift gen-driftignore --org=no-iac-drift-entitlements`,
      {},
    );

    expect(stdout).toMatch(
      'Command "drift" is currently not supported for this org. To enable it, please contact snyk support.',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (os.platform() === 'win32') {
    return; // skip following tests
  }

  it('gen-driftignore successfully executed from SNYK_DRIFTCTL_PATH env var when org has the entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac drift gen-driftignore --input=something.json --output=stdout --exclude-changed --exclude-missing --exclude-unmanaged`,
      {
        SNYK_DRIFTCTL_PATH: path.join(
          getFixturePath('iac'),
          'drift',
          'args-echo',
        ),
      },
    );

    expect(stdout).toMatch(
      'gen-driftignore --input something.json --output stdout --exclude-changed --exclude-missing --exclude-unmanaged',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
  });
});
