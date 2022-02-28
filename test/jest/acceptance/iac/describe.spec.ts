import { startMockServer } from './helpers';
import envPaths from 'env-paths';
import { driftctlVersion } from '../../../../src/lib/iac/drift';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getFixturePath } from '../../util/getFixturePath';

const paths = envPaths('snyk');

jest.setTimeout(50000);

describe('iac describe', () => {
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

  it('describe fail when not used as an iac sub-command', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk describe`, {});

    expect(stdout).toContain('Unknown command "describe"');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  it('describe fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac describe --org=no-iac-drift-entitlements`,
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
    const { stdout, stderr, exitCode } = await run(`snyk iac describe`, {
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
    const { stdout, stderr, exitCode } = await run(`snyk iac describe`, {
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
