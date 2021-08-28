import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60);

describe('snyk test --fail-on', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterAll((done) => {
    server.close(() => done());
  });

  test.each([
    ['all', 'no-vulns', 0],
    ['all', 'no-fixable', 0],
    ['all', 'upgradable', 1],
    ['all', 'patchable', 1],
    ['upgradable', 'upgradable', 1],
    ['upgradable', 'patchable', 0],
    ['patchable', 'upgradable', 0],
    ['patchable', 'patchable', 1],
    ['invalid-value', 'no-vulns', 2],
  ])(
    'snyk test --fail-on="%s" with %s result exits with %i',
    async (failOn, workspace, expectedCode) => {
      const project = await createProjectFromWorkspace('fail-on/' + workspace);
      server.setNextResponse(await project.read('vulns-result.json'));

      const { code } = await runSnykCLI(`test --fail-on=${failOn}`, {
        cwd: project.path(),
        env,
      });

      expect(code).toEqual(expectedCode);
    },
  );
});
