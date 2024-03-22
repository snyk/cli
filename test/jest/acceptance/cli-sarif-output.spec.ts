import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('test --sarif', () => {
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

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('test with --sarif returns without error and with sarif return type when no vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setCustomResponse(await project.readJSON('vulns-result-sarif.json'));

    const expectedSchemaValue =
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
    const expectedVersion = '2.1.0';
    const { code, stdout, stderr } = await runSnykCLI(`test --sarif`, {
      cwd: project.path(),
      env,
    });

    if (stderr) console.error(stderr);

    expect(code).toEqual(0);
    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);

    const outputObj = JSON.parse(stdout);
    expect(outputObj['$schema']).toEqual(expectedSchemaValue);
    expect(outputObj.version).toEqual(expectedVersion);
  });

  it('test with --sarif throws error and error contains json output with vulnerabilities when vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-fixable');
    server.setCustomResponse(await project.readJSON('vulns-result-sarif.json'));

    const expectedRuleId = 'SNYK-JS-CXCT-535487';
    const { code, stdout, stderr } = await runSnykCLI(`test --sarif`, {
      cwd: project.path(),
      env,
    });

    if (stderr) console.error(stderr);

    expect(code).toEqual(1);

    const outputObj = JSON.parse(stdout);
    expect(outputObj.runs.length > 0).toBeTruthy();
    expect(outputObj.runs[0].results.length > 0).toBeTruthy();
    expect(outputObj.runs[0].results[0].ruleId).toEqual(expectedRuleId);
  });
});
