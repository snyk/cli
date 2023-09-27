import * as path from 'path';

import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('snyk sbom: nuget options (mocked server only)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '58584';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('`sbom --assets-project-name` generates an SBOM for the NuGet project by using the project name in project.assets.json if found', async () => {
    const project = await createProjectFromFixture('nuget-assets-name');

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --assets-project-name --debug`,
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
    expect(bom.metadata.component.name).toEqual('foo-bar');
    expect(bom.components).toHaveLength(1);
  });

  test('`sbom --packages-folder=...` generates an SBOM for the NuGet project by specifying a custom path to the packages folder.', async () => {
    const project = await createProjectFromFixture(
      'nuget-with-packages-config',
    );

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json --packages-folder=${path.join(
        project.path(),
        'packages',
      )} --debug`,
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
    expect(bom.metadata.component.name).toEqual('nuget-with-packages-config');
    expect(bom.components).toHaveLength(5);
  });
});
