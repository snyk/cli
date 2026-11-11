import { fakeServer, FakeServer } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';
import { runSnykCLI } from '../util/runSnykCLI';
import { startSnykCLI } from '../util/startSnykCLI';

jest.setTimeout(1000 * 120);

describe('snyk doctor', () => {
  const env = {
    ...process.env,
    SNYK_DISABLE_ANALYTICS: '1',
  };

  describe('use doctor on the current system (live checks)', () => {
    it('outputs a human readable report', async () => {
      const { code, stdout } = await runSnykCLI('doctor', {
        env,
      });
      expect(code).toBe(0);
      expect(stdout).toContain('Snyk Doctor Diagnostic Report');
    });
  });

  describe('tenant of the org', () => {
    const usersOrg = '55555555-5555-5555-5555-555555555555';
    const tenantLookupUrl = `/rest/orgs/${usersOrg}?expand=tenant&version=2024-03-12`;
    let server: FakeServer;
    let serverEnv: Record<string, string>;

    beforeAll(async () => {
      const port = await getAvailableServerPort(process);
      const baseApi = '/v1';
      serverEnv = {
        ...(process.env as Record<string, string>),
        SNYK_API: `http://localhost:${port}${baseApi}`,
        SNYK_HOST: `http://localhost:${port}`,
        SNYK_TOKEN: '123456789',
        SNYK_DISABLE_ANALYTICS: '1',
      };
      server = fakeServer(baseApi, serverEnv.SNYK_TOKEN);
      await new Promise<void>((resolve) => server.listen(port, resolve));
    });

    afterEach(() => {
      server.restore();
    });

    afterAll(async () => {
      await server.closePromise();
    });

    it("doctor reports the tenant of the user's org when no tenant is given", async () => {
      const { code, stdout } = await runSnykCLI('doctor', { env: serverEnv });

      expect(code).toBe(0);
      expect(stdout).toContain(`Tenant: tenant-of-${usersOrg}`);
    });

    it("doctor --org <another org> reports that org's tenant", async () => {
      const anotherOrg = '66666666-6666-6666-6666-666666666666';

      const { code, stdout } = await runSnykCLI(`doctor --org=${anotherOrg}`, {
        env: serverEnv,
      });

      expect(code).toBe(0);
      expect(stdout).toContain(`Tenant: tenant-of-${anotherOrg}`);
    });

    it('a command run without a tenant does not look the tenant up, even when it sends analytics', async () => {
      const analyticsEnv = { ...serverEnv };
      delete analyticsEnv.SNYK_DISABLE_ANALYTICS;

      const { code } = await runSnykCLI('whoami --experimental', {
        env: analyticsEnv,
      });

      expect(code).toBe(0);
      expect(server.getRequests().map((req) => req.path)).toContain(
        `/hidden/orgs/${usersOrg}/analytics`,
      );
      expect(tenantLookups()).toEqual([]);
    });

    it('doctor --tenant reports the given tenant without looking it up', async () => {
      const { code, stdout } = await runSnykCLI('doctor --tenant my-tenant', {
        env: serverEnv,
      });

      expect(code).toBe(0);
      expect(stdout).toContain('Tenant: my-tenant');
      expect(tenantLookups()).toEqual([]);
    });

    it('doctor reports the tenant given with SNYK_CFG_TENANT without looking it up', async () => {
      const { code, stdout } = await runSnykCLI('doctor', {
        env: { ...serverEnv, SNYK_CFG_TENANT: 'my-env-tenant' },
      });

      expect(code).toBe(0);
      expect(stdout).toContain('Tenant: my-env-tenant');
      expect(tenantLookups()).toEqual([]);
    });

    it.each([
      {
        failure: 'is forbidden',
        breakLookup: () => server.setEndpointStatusCode(tenantLookupUrl, 403),
      },
      {
        failure: 'names no tenant',
        breakLookup: () =>
          server.setEndpointResponse(tenantLookupUrl, {
            data: { id: usersOrg, type: 'org', attributes: {} },
          }),
      },
    ])(
      'doctor still reports, with an empty tenant, when the org record $failure',
      async ({ breakLookup }) => {
        breakLookup();

        const { code, stdout } = await runSnykCLI('doctor', { env: serverEnv });

        expect(code).toBe(0);
        expect(stdout).toContain('Snyk Doctor Diagnostic Report');
        expect(stdout).toMatch(/^- Tenant: $/m);
        expect(tenantLookups()).not.toEqual([]);
      },
    );

    it("the debug log header shows the tenant of the user's org", async () => {
      const { code, stderr } = await runSnykCLI('whoami --experimental -d', {
        env: serverEnv,
      });

      expect(code).toBe(0);
      expect(stderr).toMatch(new RegExp(`Tenant:\\s+tenant-of-${usersOrg}`));
    });

    it('a failed tenant lookup for the debug log header does not leak into the output', async () => {
      server.setEndpointStatusCode(tenantLookupUrl, 403);

      const { code, stdout } = await runSnykCLI(
        'whoami --experimental --json -d',
        { env: serverEnv },
      );

      expect(code).toBe(0);
      expect(() => JSON.parse(stdout)).not.toThrow();
      expect(tenantLookups()).not.toEqual([]);
    });

    const tenantLookups = () =>
      server
        .getRequests()
        .filter((req) => req.query.expand === 'tenant')
        .map((req) => req.url);
  });

  describe('use doctor on the debug logs of another system', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const sampleLog = [
      '2026-06-10T13:10:38Z main - < response [0x1]: 401 Unauthorized',
      '2026-06-10T13:10:38Z main - ------------ Summary ------------',
      '2026-06-10T13:10:38Z main - ------------ Errors ------------',
      '2026-06-10T13:10:38Z main - Authentication error (SNYK-0005)',
      '2026-06-10T13:10:38Z main - Exit Code:             2',
    ].join('\n');

    let logFile: string;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
      logFile = path.join(tmpDir, 'debug.log');
      fs.writeFileSync(logFile, sampleLog);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('analyzes the debug log and reports findings', async () => {
      const { code, stdout } = await runSnykCLI(`doctor --input=${logFile}`, {
        env,
      });

      expect(code).toBe(0);
      expect(stdout).toContain('Snyk Doctor Diagnostic Report');
    });

    it('--input with non-existent file', async () => {
      const { code } = await runSnykCLI(
        'doctor --input=/tmp/does-not-exist-snyk-doctor-test.log',
        { env },
      );

      expect(code).not.toBe(0);
    });

    it('analyzes debug logs piped via --stdin', async () => {
      const cli = await startSnykCLI('doctor --stdin', { env });

      await cli.input(sampleLog);
      cli.process.stdin.end();

      await expect(cli).toDisplay('Snyk Doctor Diagnostic Report');
      await expect(cli).toExitWith(0);
    });
  });
});
