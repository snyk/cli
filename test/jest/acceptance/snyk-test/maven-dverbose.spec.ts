import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { isDontSkipTestsEnabled } from '../../util/isDontSkipTestsEnabled';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('`snyk test` of basic projects for each language/ecosystem', () => {
  let server;
  let env: Record<string, string>;
  let dontSkip: boolean;

  beforeAll((done) => {
    const port = getServerPort(process);
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
    dontSkip = isDontSkipTestsEnabled();
    console.debug("Don't skip tests: " + dontSkip);
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

  test('run `snyk test` on a maven project with Dverbose', async () => {
    const project = await createProjectFromWorkspace('maven-app');

    const { code } = await runSnykCLI('test -d - --Dverbose', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a maven project with scopes collision with Dverbose', async () => {
    const project = await createProjectFromWorkspace(
      'maven-dverbose-scopes-collision',
    );

    const { code } = await runSnykCLI('test -d - --Dverbose', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });

  test('run `snyk test` on a maven project with Dverbose omitted versions', async () => {
    const project = await createProjectFromWorkspace(
      'maven-dverbose-omitted-versions',
    );

    const { code } = await runSnykCLI('test -d - --Dverbose', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
  });
});
