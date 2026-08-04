import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { resolve, join } from 'path';
import { readFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { getAvailableServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

// The cos (Continuous Offensive Security / AI pen test) extension is a client
// of the hidden API under /hidden/tenants/:tenantId/cos, plus the tenant
// discovery call to /rest/tenants when --tenant-id is omitted. Requests are
// JSON:API (application/vnd.api+json); the PDF report is a binary download.
//
// The endpoint contract is owned by github.com/snyk/cli-extension-cos, so it is
// not restated here: every test registers the endpoints it expects and asserts
// the requests the binary actually made, keeping the routes documented where
// they are exercised.

const tenantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const scanId = '11111111-2222-3333-4444-555555555555';
const targetId = '66666666-7777-8888-9999-aaaaaaaaaaaa';
const findingId = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

const scansPath = `/api/hidden/tenants/${tenantId}/cos/scans`;
const scanPath = `${scansPath}/${scanId}`;
const targetsPath = `/api/hidden/tenants/${tenantId}/cos/targets`;
const targetPath = `${targetsPath}/${targetId}`;
const findingsPath = `/api/hidden/tenants/${tenantId}/cos/findings`;
const findingPath = `${findingsPath}/${findingId}`;
const tenantsPath = '/api/rest/tenants';

function scanResource(overrides: Record<string, unknown> = {}) {
  return {
    type: 'scan',
    id: scanId,
    attributes: {
      tenant_id: tenantId,
      target_id: targetId,
      target_url: 'https://demo-app.com',
      status: 'running',
      created_at: '2024-10-15T10:00:00Z',
      updated_at: '2024-10-15T10:05:00Z',
      ...overrides,
    },
  };
}

function targetResource(overrides: Record<string, unknown> = {}) {
  return {
    type: 'target',
    id: targetId,
    attributes: {
      tenant_id: tenantId,
      name: 'Demo App',
      url: 'https://demo-app.com',
      created_at: '2024-10-15T10:00:00Z',
      updated_at: '2024-10-15T10:00:00Z',
      ...overrides,
    },
  };
}

function findingResource(overrides: Record<string, unknown> = {}) {
  return {
    type: 'finding',
    id: findingId,
    attributes: {
      tenant_id: tenantId,
      target_id: targetId,
      title: 'SQL Injection',
      category: 'injection',
      severity: 'high',
      endpoint: '/login',
      state: 'open',
      ...overrides,
    },
  };
}

describe('snyk cos (mocked servers only)', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;
  let envWithoutAuth: Record<string, string>;
  let tmpDirs: string[] = [];
  let configHome: string | undefined;

  const projectRoot = resolve(__dirname, '../../../..');
  const configFile = resolve(projectRoot, 'test/fixtures/cos/cos.yaml');
  const invalidConfigFile = resolve(
    projectRoot,
    'test/fixtures/cos/cos_invalid.yaml',
  );

  beforeAll(async () => {
    const baseApi = '/api/v1';
    const ipAddr = getFirstIPv4Address();
    const port = await getAvailableServerPort(process);
    const serverBase = `http://${ipAddr}:${port}`;

    server = fakeServer(baseApi, '123456789');
    await server.listenPromise(port);

    env = {
      ...process.env,
      SNYK_API: `${serverBase}${baseApi}`,
      SNYK_HOST: serverBase,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_CFG_ORG: tenantId,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    // Trigger "unauthenticated" regardless of how the extension detects auth:
    // clear the organization scope AND every credential source (token / OAuth),
    // and point at an isolated config dir so persisted credentials can't leak in.
    configHome = mkdtempSync(join(tmpdir(), 'snyk-cos-config-'));
    envWithoutAuth = {
      ...env,
      SNYK_TOKEN: '',
      SNYK_OAUTH_TOKEN: '',
      INTERNAL_OAUTH_TOKEN_STORAGE: '',
      SNYK_CFG_ORG: '',
      SNYK_ORG: '',
      TEST_SNYK_TOKEN: 'UNSET',
      XDG_CONFIG_HOME: configHome,
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  afterAll(() => {
    if (configHome) {
      rmSync(configHome, { recursive: true, force: true });
      configHome = undefined;
    }
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // Every directory handed out here is removed after the test that asked for it.
  function makeTmpDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'snyk-cos-'));
    tmpDirs.push(dir);
    return dir;
  }

  type RecordedRequest = { method: string; path: string };

  // Matching on a URL fragment keeps assertions resilient to the
  // auth/analytics/config requests the CLI makes around the ones under test.
  function requestsMatching(fragment: string): RecordedRequest[] {
    return server
      .getRequests()
      .filter((req) => req.url?.includes(fragment))
      .map((req) => ({
        method: req.method as string,
        path: (req.url as string).split('?')[0],
      }));
  }

  // The hidden /cos endpoints. Tenant discovery lives in another namespace, so
  // it is asserted separately.
  const cosRequests = () => requestsMatching('/hidden/tenants/');
  const tenantRequests = () => requestsMatching('/rest/tenants');

  describe('experimental gate', () => {
    test('`scan list` requires --experimental', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan list --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('experimental');
      // No API call should be made before the gate.
      expect(cosRequests()).toEqual([]);
    });
  });

  // Every other test passes --tenant-id, which skips discovery.
  describe('tenant discovery', () => {
    test('resolves the tenant when --tenant-id is omitted', async () => {
      server.setEndpointResponse(tenantsPath, {
        data: [{ type: 'tenant', id: tenantId, attributes: { name: 'Acme' } }],
      });
      server.setEndpointResponse(scansPath, {
        data: [scanResource()],
        links: { self: scansPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain(scanId);

      expect(tenantRequests()).toEqual([{ method: 'GET', path: tenantsPath }]);
      // The discovered tenant scopes the request: its id is part of the path.
      expect(cosRequests()).toEqual([{ method: 'GET', path: scansPath }]);
    });
  });

  describe('cos scan list', () => {
    test('lists scans in a table', async () => {
      server.setEndpointResponse(scansPath, {
        data: [scanResource()],
        links: { self: scansPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('ID');
      expect(stdout).toContain('STATUS');
      expect(stdout).toContain(scanId);
      expect(stdout).toContain('running');

      expect(cosRequests()).toEqual([{ method: 'GET', path: scansPath }]);
    });

    test('renders JSON with -o json', async () => {
      server.setEndpointResponse(scansPath, {
        data: [scanResource()],
        links: { self: scansPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental --tenant-id=${tenantId} -o json`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed.scans).toHaveLength(1);
      expect(parsed.scans[0]).toMatchObject({
        id: scanId,
        status: 'running',
      });
    });

    test('handles an empty result', async () => {
      server.setEndpointResponse(scansPath, {
        data: [],
        links: { self: scansPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('No scans found.');
    });

    test('surfaces a server error', async () => {
      server.setEndpointResponse(scansPath, {
        errors: [{ status: '500', title: 'Internal Server Error' }],
      });
      server.setEndpointStatusCode(scansPath, 500);

      // --max-attempts=1 disables network retries so the 500 fails fast.
      const { code } = await runSnykCLI(
        `cos scan list --experimental --tenant-id=${tenantId} --max-attempts=1`,
        { env },
      );
      expect(code).toEqual(2);
    });
  });

  describe('cos scan start', () => {
    test('creates a scan for a target', async () => {
      server.setEndpointResponse(scansPath, {
        data: scanResource({ status: 'queued' }),
        links: { self: scanPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan start --target-id=${targetId} --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('Scan started');
      expect(stdout).toContain(scanId);

      expect(cosRequests()).toEqual([{ method: 'POST', path: scansPath }]);
    });

    test('fails without --target-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan start --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--target-id');
      // Validation happens before any API call.
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos scan status', () => {
    test('reports the status of a scan', async () => {
      server.setEndpointResponse(scanPath, {
        data: scanResource({ status: 'completed' }),
        links: { self: scanPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan status --experimental --tenant-id=${tenantId} --scan-id=${scanId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('Scan');
      expect(stdout).toContain(scanId);
      expect(stdout).toContain('completed');

      expect(cosRequests()).toEqual([{ method: 'GET', path: scanPath }]);
    });

    test('renders JSON with --json', async () => {
      server.setEndpointResponse(scanPath, {
        data: scanResource({ status: 'completed' }),
        links: { self: scanPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan status --experimental --tenant-id=${tenantId} --scan-id=${scanId} --json`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toMatchObject({
        id: scanId,
        status: 'completed',
      });
    });

    test('fails without --scan-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan status --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--scan-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos scan cancel', () => {
    test('cancels a scan', async () => {
      const cancelPath = `${scanPath}/cancel`;
      server.setEndpointResponse(cancelPath, {
        data: scanResource({ status: 'canceled' }),
        links: { self: scanPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan cancel --experimental --tenant-id=${tenantId} --scan-id=${scanId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('canceled');
      expect(stdout).toContain(scanId);

      expect(cosRequests()).toEqual([{ method: 'POST', path: cancelPath }]);
    });

    test('fails without --scan-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan cancel --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--scan-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos scan report', () => {
    test('prints the report JSON', async () => {
      const reportPath = `${scanPath}/report`;
      server.setEndpointResponse(reportPath, {
        data: {
          type: 'scan_report',
          id: scanId,
          attributes: { summary: { issues: 2 }, findings: ['a', 'b'] },
        },
      });

      const { code, stdout } = await runSnykCLI(
        `cos scan report --experimental --tenant-id=${tenantId} --scan-id=${scanId}`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toMatchObject({
        summary: { issues: 2 },
        findings: ['a', 'b'],
      });

      expect(cosRequests()).toEqual([{ method: 'GET', path: reportPath }]);
    });

    test('writes the report to --output-file', async () => {
      const reportPath = `${scanPath}/report`;
      server.setEndpointResponse(reportPath, {
        data: {
          type: 'scan_report',
          id: scanId,
          attributes: { summary: { issues: 0 } },
        },
      });

      const outFile = join(makeTmpDir(), 'report.json');

      const { code } = await runSnykCLI(
        `cos scan report --experimental --tenant-id=${tenantId} --scan-id=${scanId} --output-file=${outFile}`,
        { env },
      );
      expect(code).toEqual(0);

      const written = JSON.parse(readFileSync(outFile, 'utf-8'));
      expect(written).toMatchObject({ summary: { issues: 0 } });
    });

    test('downloads the PDF report with -o pdf', async () => {
      const pdfPath = `${scanPath}/report/pdf`;
      const pdfBody = '%PDF-1.4 pretend report';
      server.setEndpointHeaders(pdfPath, { 'Content-Type': 'application/pdf' });
      server.setEndpointResponse(pdfPath, pdfBody);

      const outFile = join(makeTmpDir(), 'report.pdf');

      const { code, stdout } = await runSnykCLI(
        `cos scan report --experimental --tenant-id=${tenantId} --scan-id=${scanId} -o pdf --output-file=${outFile}`,
        { env },
      );
      expect(code).toEqual(0);
      // A binary report is written to disk, with only a summary on stdout.
      expect(stdout).toContain(outFile);
      expect(readFileSync(outFile, 'utf-8')).toEqual(pdfBody);

      expect(cosRequests()).toEqual([{ method: 'GET', path: pdfPath }]);

      // The download negotiates a different media type than the JSON:API reads.
      const pdfRequest = server
        .getRequests()
        .find((req) => req.url?.includes('/report/pdf'));
      expect(pdfRequest?.headers.accept).toContain('application/pdf');
    });

    test('fails without --scan-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan report --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--scan-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos target create', () => {
    test('creates a target from a config file', async () => {
      server.setEndpointResponse(targetsPath, {
        data: targetResource(),
        links: { self: `${targetsPath}/${targetId}` },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target create --experimental --tenant-id=${tenantId} --config=${configFile}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('Target created');
      expect(stdout).toContain(targetId);

      expect(cosRequests()).toEqual([{ method: 'POST', path: targetsPath }]);
    });

    test('fails when the config is missing target.url', async () => {
      const { code } = await runSnykCLI(
        `cos target create --experimental --tenant-id=${tenantId} --config=${invalidConfigFile}`,
        { env },
      );
      expect(code).toEqual(2);
      // Validation happens before any API call.
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos target list', () => {
    test('lists targets in a table', async () => {
      server.setEndpointResponse(targetsPath, {
        data: [targetResource()],
        links: { self: targetsPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target list --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('ID');
      expect(stdout).toContain('NAME');
      expect(stdout).toContain(targetId);
      expect(stdout).toContain('Demo App');

      expect(cosRequests()).toEqual([{ method: 'GET', path: targetsPath }]);
    });

    test('handles an empty result', async () => {
      server.setEndpointResponse(targetsPath, {
        data: [],
        links: { self: targetsPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target list --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('No targets found.');
    });
  });

  describe('cos target get', () => {
    test('shows a target', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target get --experimental --tenant-id=${tenantId} --target-id=${targetId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain(targetId);
      expect(stdout).toContain('Demo App');
      expect(stdout).toContain('https://demo-app.com');

      expect(cosRequests()).toEqual([{ method: 'GET', path: targetPath }]);
    });

    test('renders JSON with -o json', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target get --experimental --tenant-id=${tenantId} --target-id=${targetId} -o json`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toMatchObject({
        id: targetId,
        name: 'Demo App',
        url: 'https://demo-app.com',
      });
    });

    test('fails without --target-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos target get --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--target-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos target update', () => {
    test('updates a target from a config file', async () => {
      // One registration answers both requests: the endpoint config is keyed by
      // path, not by method.
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target update --experimental --tenant-id=${tenantId} --target-id=${targetId} --config=${configFile}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('Target updated');
      expect(stdout).toContain(targetId);

      expect(cosRequests()).toEqual([
        { method: 'GET', path: targetPath },
        { method: 'PATCH', path: targetPath },
      ]);
    });

    test('fails without --config', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos target update --experimental --tenant-id=${tenantId} --target-id=${targetId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--config');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos target delete', () => {
    test('deletes a target with --yes', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target delete --experimental --tenant-id=${tenantId} --target-id=${targetId} --yes`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain(targetId);
      expect(stdout).toContain('deleted');

      expect(cosRequests()).toEqual([
        { method: 'GET', path: targetPath },
        { method: 'DELETE', path: targetPath },
      ]);
    });
  });

  describe('cos target dump', () => {
    test('prints the target configuration as YAML', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos target dump --experimental --tenant-id=${tenantId} --target-id=${targetId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('target:');
      expect(stdout).toContain('name: Demo App');
      expect(stdout).toContain('url: https://demo-app.com');

      expect(cosRequests()).toEqual([{ method: 'GET', path: targetPath }]);
    });

    test('writes the YAML to --output-file', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });

      const outFile = join(makeTmpDir(), 'cos.yaml');

      const { code } = await runSnykCLI(
        `cos target dump --experimental --tenant-id=${tenantId} --target-id=${targetId} --output-file=${outFile}`,
        { env },
      );
      expect(code).toEqual(0);

      const written = readFileSync(outFile, 'utf-8');
      expect(written).toContain('name: Demo App');
      expect(written).toContain('url: https://demo-app.com');
    });
  });

  describe('cos finding list', () => {
    test('lists findings in a table', async () => {
      // The command resolves --target-id before listing, so the target lookup
      // has to answer as well.
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });
      server.setEndpointResponse(findingsPath, {
        data: [findingResource()],
        links: { self: findingsPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos finding list --experimental --tenant-id=${tenantId} --target-id=${targetId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('ID');
      expect(stdout).toContain('SEVERITY');
      expect(stdout).toContain(findingId);
      expect(stdout).toContain('high');

      expect(cosRequests()).toEqual([
        { method: 'GET', path: targetPath },
        { method: 'GET', path: findingsPath },
      ]);
    });

    test('renders JSON with -o json', async () => {
      server.setEndpointResponse(targetPath, {
        data: targetResource(),
        links: { self: targetPath },
      });
      server.setEndpointResponse(findingsPath, {
        data: [findingResource()],
        links: { self: findingsPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos finding list --experimental --tenant-id=${tenantId} --target-id=${targetId} -o json`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0]).toMatchObject({
        id: findingId,
        severity: 'high',
      });
    });

    test('fails without --target-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos finding list --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--target-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('cos finding get', () => {
    test('shows the finding detail', async () => {
      server.setEndpointResponse(findingPath, {
        data: findingResource({
          description: 'The login form concatenates input into a SQL query.',
        }),
        links: { self: findingPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos finding get --experimental --tenant-id=${tenantId} --finding-id=${findingId}`,
        { env },
      );
      expect(code).toEqual(0);
      expect(stdout).toContain(findingId);
      expect(stdout).toContain('SQL Injection');
      expect(stdout).toContain('high');
      expect(stdout).toContain('/login');
      // Detail fields are rendered under their own headings.
      expect(stdout).toContain('Description');
      expect(stdout).toContain('concatenates input into a SQL query');

      expect(cosRequests()).toEqual([{ method: 'GET', path: findingPath }]);
    });

    test('renders JSON with --json', async () => {
      server.setEndpointResponse(findingPath, {
        data: findingResource(),
        links: { self: findingPath },
      });

      const { code, stdout } = await runSnykCLI(
        `cos finding get --experimental --tenant-id=${tenantId} --finding-id=${findingId} --json`,
        { env },
      );
      expect(code).toEqual(0);

      const parsed = JSON.parse(stdout);
      expect(parsed).toMatchObject({
        id: findingId,
        severity: 'high',
        title: 'SQL Injection',
      });
    });

    test('fails without --finding-id', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos finding get --experimental --tenant-id=${tenantId}`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--finding-id');
      expect(cosRequests()).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('handles unauthenticated requests', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental --tenant-id=${tenantId}`,
        { env: envWithoutAuth },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('Authentication error (SNYK-0005)');
    });

    test('rejects the --org flag', async () => {
      const { code, stdout } = await runSnykCLI(
        `cos scan list --experimental --org=my-org`,
        { env },
      );
      expect(code).toEqual(2);
      expect(stdout).toContain('--org');
    });
  });
});
