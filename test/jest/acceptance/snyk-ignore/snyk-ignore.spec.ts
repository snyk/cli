import { load as loadPolicy } from 'snyk-policy';
import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk ignore', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789', // replace token from process.env
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('creates a policy file using minimal options', async () => {
    const project = await createProjectFromWorkspace('empty');
    const { code } = await runSnykCLI(`ignore --id=ID`, {
      cwd: project.path(),
      env: env,
    });

    expect(code).toEqual(0);

    const policy = await loadPolicy(project.path());
    expect(policy).toMatchObject({
      ignore: {
        ID: [
          {
            '*': {
              reason: 'None Given',
              expires: expect.any(Date),
              created: expect.any(Date),
            },
          },
        ],
      },
    });
  });

  it('creates a policy file using provided options', async () => {
    const project = await createProjectFromWorkspace('empty');
    const { code } = await runSnykCLI(
      `ignore --id=ID --reason=REASON --expiry=2017-10-07 --policy-path=${project.path()}`,
      {
        cwd: project.path(),
        env: env,
      },
    );

    expect(code).toEqual(0);
    const policy = await loadPolicy(project.path());
    expect(policy).toMatchObject({
      ignore: {
        ID: [
          {
            '*': {
              reason: 'REASON',
              expires: new Date('2017-10-07'),
              created: expect.any(Date),
            },
          },
        ],
      },
    });
  });

  it('fails on missing ID', async () => {
    const project = await createProjectFromWorkspace('empty');
    const { code, stdout } = await runSnykCLI(`ignore --reason=REASON`, {
      cwd: project.path(),
      env: env,
    });

    expect(code).toEqual(2);
    expect(stdout).toMatch('id is a required field');
  });

  it('errors when user is not authorized to ignore', async () => {
    const project = await createProjectFromWorkspace('empty');
    server.unauthorizeAction('cliIgnore', 'not allowed');

    const { code, stdout } = await runSnykCLI(`ignore --id=ID`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('not allowed');
  });
});
