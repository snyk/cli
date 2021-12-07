import { fakeServer } from '../../../acceptance/fake-server';
import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 30);

describe('snyk test with patched vulnerabilities', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
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
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('takes into account patched vulnerabilities', async () => {
    const project = await createProjectFromFixture(
      'project-with-patchable-dep-fixture-and-snyk-patched',
    );

    server.setDepGraphResponse(
      await project.readJSON('test-dep-graph-response.json'),
    );

    const { stdout } = await runSnykCLI('test --json', {
      cwd: project.path(),
      env,
    });

    const outputObj = JSON.parse(stdout);

    expect(outputObj).toMatchObject({
      vulnerabilities: expect.not.arrayContaining([
        expect.objectContaining({
          id: 'SNYK-JS-LODASH-567746',
        }),
      ]),
      filtered: {
        patch: [
          {
            id: 'SNYK-JS-LODASH-567746',
            patches: [
              {
                id: 'patch:SNYK-JS-LODASH-567746:0',
              },
            ],
            name: 'lodash',
            version: '4.17.15',
            filtered: {
              patches: [
                {
                  path: ['@snyk/patchable-dep-fixture', 'lodash'],
                },
              ],
            },
          },
        ],
      },
    });
  });
});
