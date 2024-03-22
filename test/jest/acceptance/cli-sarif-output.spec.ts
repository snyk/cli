import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import * as Parser from 'jsonparse';

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

  describe('handling responses larger than 512Mb string size limit in v8', () => {
    it('container test --sarif', async () => {
      const expectedReferenceNumber = 420000;
      const issueID = 'SNYK-ALPINE319-OPENSSL-6148881';
      const project = await createProjectFromWorkspace(
        'extra-large-response-payload',
      );
      const response = await project.readJSON('vulns-result-sarif.json');
      const reference = response.result.issuesData[issueID].references[0];
      response.result.issuesData[issueID].references = new Array(
        expectedReferenceNumber,
      ).fill(reference);

      server.setCustomResponse(response);

      const imageName = 'hello-world:latest';
      const { code, stdoutBuffer, stderrBuffer } = await runSnykCLI(
        `container test --platform=linux/amd64 ${imageName} --sarif`,
        {
          cwd: project.path(),
          env,
          bufferOutput: true,
        },
      );

      if (stderrBuffer && stderrBuffer.length > 0)
        console.log(stderrBuffer?.toString('utf8'));

      let hasExpectedSchema = false;
      let hasExpectedVersion = false;

      const expectedSchema =
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
      const expectedVersion = '2.1.0';

      const p = new Parser();
      p.onValue = function(value) {
        if (this.key === '$schema' && value === expectedSchema) {
          hasExpectedSchema = true;
        } else if (this.key === 'version' && value === expectedVersion) {
          hasExpectedVersion = true;
        }
      };

      p.write(stdoutBuffer);

      expect(code).toEqual(1);
      expect(hasExpectedSchema).toBeTruthy();
      expect(hasExpectedVersion).toBeTruthy();
    }, 120000);
  });
});
