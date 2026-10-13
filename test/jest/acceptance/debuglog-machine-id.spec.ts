import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getAvailableServerPort } from '../util/getServerPort';
import { describeIf, isWindowsOperatingSystem, testIf } from '../../utils';

jest.setTimeout(1000 * 60);

// The per-user machine id file lives under HOME only on macOS and Linux.
describeIf(!isWindowsOperatingSystem())('debug log machine id', () => {
  let server;
  let env: Record<string, string>;
  let home: string;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    const fakeServerIp = getFirstIPv4Address();
    env = {
      ...(process.env as Record<string, string>),
      SNYK_API: `http://${fakeServerIp}:${port}`,
      SNYK_HOST: `http://${fakeServerIp}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-machine-id-'));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
    server.restore();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const runWhoamiWithDebugLog = async (extraEnv = {}) => {
    const { stderr } = await runSnykCLI('whoami --experimental -d', {
      env: { ...env, HOME: home, ...extraEnv },
    });
    return stderr;
  };

  it('shows the machine id supplied by the caller', async () => {
    const supplied = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    const stderr = await runWhoamiWithDebugLog({
      INTERNAL_SNYK_MACHINE_ID: supplied,
    });

    expect(stderr.match(/Machine ID:\s+(\S+)/)?.[1]).toEqual(supplied);
  });

  it('shows the machine id stored for this user', async () => {
    const stderr = await runWhoamiWithDebugLog();

    const logged = stderr.match(/Machine ID:\s+(\S+)/)?.[1];
    const stored = JSON.parse(
      fs.readFileSync(path.join(home, '.snyk', 'machine-id.json'), 'utf8'),
    );
    expect(logged).toEqual(stored.machine_id);
  });

  // Root reads files regardless of their permissions.
  testIf(process.getuid?.() !== 0)(
    'explains why the machine id file could not be read',
    async () => {
      const firstRun = await runWhoamiWithDebugLog();
      expect(firstRun).toMatch(/Machine ID:\s+\S+/);
      const machineIdFile = path.join(home, '.snyk', 'machine-id.json');
      fs.chmodSync(machineIdFile, 0o000);

      const stderr = await runWhoamiWithDebugLog();

      expect(stderr).toMatch(
        /SNYK-CLI-0030 Machine ID file unreadable: .*\.snyk\/machine-id\.json/,
      );
    },
  );
});
