import { execSync } from 'child_process';

import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom --command (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(
    () =>
      new Promise((res) => {
        const port = process.env.PORT || process.env.SNYK_PORT || '58588';
        const baseApi = '/api/v1';
        env = {
          ...process.env,
          SNYK_API: 'http://localhost:' + port + baseApi,
          SNYK_HOST: 'http://localhost:' + port,
          SNYK_TOKEN: '123456789',
          SNYK_DISABLE_ANALYTICS: '1',
        };
        server = fakeServer(baseApi, env.SNYK_TOKEN);
        server.listen(port, res);
      }),
  );

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(
    () =>
      new Promise((res) => {
        server.close(res);
      }),
  );

  test('`sbom pip-app` generates an SBOM with a specified python command', async () => {
    const project = await createProjectFromWorkspace('pip-app');
    const command = isWindowsOperatingSystem() ? 'python3.11.exe' : 'python3';
    execSync(`pip install -r requirements.txt`, { cwd: project.path() });

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --command=${command}`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual('pip-app');
    expect(bom.components).toHaveLength(3);
  });

  test('`sbom pip-app-custom` generates an SBOM with pip for custom manifest names', async () => {
    const project = await createProjectFromWorkspace('pip-app-custom');
    execSync(`pip install -r base.txt`, { cwd: project.path() });

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --package-manager=pip --file=base.txt`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual('pip-app-custom');
    expect(bom.components).toHaveLength(3);
  });

  test('`sbom pip-app-private` generates an SBOM and skips unresolved packages', async () => {
    const project = await createProjectFromWorkspace('pip-app-private');

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --debug --skip-unresolved=true`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();
    expect(bom.metadata.component.name).toEqual('pip-app-private');
  });
});
