import * as fs from 'fs';
import * as path from 'path';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { testIf } from '../../../utils';
import { createProjectFromFixture } from '../../util/createProject';
import { getCliBinaryPath } from '../../util/getCliBinaryPath';
import { getFixturePath } from '../../util/getFixturePath';
import { getAvailableServerPort } from '../../util/getServerPort';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

const hasBinary = !!process.env.TEST_SNYK_COMMAND;

describe('uv monitor', () => {
  let server: FakeServer;
  let env: Record<string, string>;
  const orgId = '55555555-5555-5555-5555-555555555555';

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/v1';
    const apiEndpoint = 'http://localhost:' + port + baseApi;
    env = {
      ...process.env,
      SNYK_API: apiEndpoint,
      SNYK_CFG_ORG: orgId,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    if (hasBinary) {
      env.SNYK_CLI_EXECUTABLE_PATH = getCliBinaryPath();
    }
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    return new Promise<void>((res) => {
      server.listen(port, res);
    });
  });

  afterEach(() => {
    server.restore();
  });

  beforeEach(() => {
    const body = fs.readFileSync(
      path.resolve(
        getFixturePath('sbom'),
        'sbom-convert-response-uv-monitor.json',
      ),
      'utf8',
    );

    const response = JSON.parse(body);
    server.setEndpointResponse(`/hidden/orgs/${orgId}/sboms/convert`, response);
  });

  afterAll(async () => {
    await new Promise<void>((res) => server.close(res));
  });

  testIf(hasBinary)(
    'sends the dep-graph from the Go binary to the monitor endpoint',
    async () => {
      server.setFeatureFlag('enableUvCLI', true);

      const project = await createProjectFromFixture('uv-project');
      const runEnv = {
        ...env,
        SNYK_INTERNAL_UV_MONITOR_ENABLED: 'true',
        XDG_CONFIG_HOME: project.path(),
      };

      const { code, stdout, stderr } = await runSnykCLI(
        'monitor --file=uv.lock',
        {
          env: runEnv,
          cwd: project.path(),
        },
      );

      console.log('exit code:', code);
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
      console.log(
        'all server requests:',
        server.getRequests().map((r) => `${r.method} ${r.url}`),
      );
      expect(code).toEqual(0);
      expect(stdout).toContain('Monitoring');

      const monitorRequests = server
        .getRequests()
        .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

      expect(monitorRequests).toHaveLength(1);
      expect(monitorRequests[0].body.meta.pluginRuntime).toBeUndefined();
      expect(monitorRequests[0].body.targetFile).toBe('pyproject.toml');

      const depGraphJSON = monitorRequests[0].body.depGraphJSON;
      expect(depGraphJSON).toBeDefined();

      expect(depGraphJSON.pkgManager.name).toBe('pip');

      const rootPkg = depGraphJSON.pkgs.find(
        (p: any) => p.id === 'uv-project@0.1.0',
      );
      expect(rootPkg).toBeDefined();
      expect(rootPkg.info).toEqual({ name: 'uv-project', version: '0.1.0' });

      const depNames = depGraphJSON.pkgs.map((p: any) => p.info.name).sort();
      expect(depNames).toEqual([
        'cffi',
        'cryptography',
        'pycparser',
        'urllib3',
        'uv-project',
      ]);

      const nodeIds = depGraphJSON.graph.nodes.map((n: any) => n.nodeId).sort();
      expect(nodeIds).toEqual([
        'cffi@2.0.0',
        'cryptography@40.0.0',
        'pycparser@3.0',
        'urllib3@1.26.15',
        'uv-project@0.1.0',
      ]);
    },
  );

  it('does not monitor uv projects when the feature flag is disabled', async () => {
    server.setFeatureFlag('enableUvCLI', false);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env: {
        ...env,
        SNYK_INTERNAL_UV_MONITOR_ENABLED: 'true',
        XDG_CONFIG_HOME: project.path(),
      },
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });

  it('does not monitor uv projects when the env var is not set', async () => {
    server.setFeatureFlag('enableUvCLI', true);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env: {
        ...env,
        XDG_CONFIG_HOME: project.path(),
      },
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });

  it('does not monitor uv projects when both feature flag and env var are disabled', async () => {
    server.setFeatureFlag('enableUvCLI', false);

    const project = await createProjectFromFixture('uv-project');

    const { code } = await runSnykCLI('monitor --file=uv.lock', {
      env: {
        ...env,
        XDG_CONFIG_HOME: project.path(),
      },
      cwd: project.path(),
    });

    expect(code).not.toEqual(0);

    const monitorRequests = server
      .getRequests()
      .filter((request) => /\/monitor\/[^/]+\/graph/.test(request.url));

    expect(monitorRequests).toHaveLength(0);
  });
});
