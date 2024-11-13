import { fakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { getServerPort } from '../util/getServerPort';
import { runSnykCLI } from '../util/runSnykCLI';
import { AppliedPolicyRules } from '../../../src/lib/formatters/types';
import * as Parser from 'jsonparse';

jest.setTimeout(1000 * 60);

describe('test --json', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = getServerPort(process);
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

  it('test with --json returns without error and with JSON return type when no vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setCustomResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    const outputObj = JSON.parse(stdout);
    expect(outputObj).not.toBe('');
  });

  it('test without --json returns without error and with a string return type when no vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setCustomResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    expect(stdout).not.toBe('');
    expect(typeof stdout).toBe('string');
  });

  it('test with --json throws error and error contains json output with vulnerabilities when vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-fixable');
    server.setCustomResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    const returnedJson = JSON.parse(stdout);
    expect(returnedJson.vulnerabilities.length > 0).toBeTruthy();
    expect(code).toEqual(1);
    expect(stdout).not.toBe('');
  });

  describe('handling responses larger than 512Mb string size limit in v8', () => {
    it('container test --json', async () => {
      const expectedReferenceNumber = 420000;
      const issueID = 'SNYK-ALPINE319-OPENSSL-6148881';
      const project = await createProjectFromWorkspace(
        'extra-large-response-payload',
      );
      const response = await project.readJSON('vulns-result.json');
      const reference = response.result.issuesData[issueID].references[0];
      response.result.issuesData[issueID].references = new Array(
        expectedReferenceNumber,
      ).fill(reference);

      server.setCustomResponse(response);

      const imageName = 'hello-world:latest';
      const { code, stdoutBuffer, stderrBuffer } = await runSnykCLI(
        `container test --platform=linux/amd64 ${imageName} --json`,
        {
          cwd: project.path(),
          env,
          bufferOutput: true,
        },
      );

      if (stderrBuffer && stderrBuffer.length > 0)
        console.log(stderrBuffer?.toString('utf8'));

      let hasExpectedPathString = false;
      let hasExpectedVulnerabilitiesString = false;
      let hasReferenceCount = false;

      const p = new Parser();
      p.onValue = function (value) {
        if (this.key === 'path' && value === imageName) {
          hasExpectedPathString = true;
        } else if (this.key === 'vulnerabilities') {
          hasExpectedVulnerabilitiesString = true;
        } else if (
          this.key === 'references' &&
          value.length === expectedReferenceNumber
        ) {
          hasReferenceCount = true;
        }
      };

      p.write(stdoutBuffer);

      expect(code).toEqual(1);
      expect(hasExpectedVulnerabilitiesString).toBeTruthy();
      expect(hasExpectedPathString).toBeTruthy();
      expect(hasReferenceCount).toBeTruthy();
    }, 120000);
  });

  describe('when policy data is available', () => {
    it('includes a user note and reason', async () => {
      const project = await createProjectFromWorkspace(
        'npm-package-single-vuln',
      );
      server.setCustomResponse(
        await project.readJSON('test-graph-results-with-annotation.json'),
      );

      const { code, stdout } = await runSnykCLI(`test --json`, {
        cwd: project.path(),
        env,
      });

      const expectedPolicyData: AppliedPolicyRules = {
        annotation: {
          value: 'This is a test user note',
          reason: 'This vulnerability is a papercut and can be ignored',
        },
      };

      const returnedJson = JSON.parse(stdout);
      const actualPolicyData =
        returnedJson.vulnerabilities[0].appliedPolicyRules;

      expect(actualPolicyData).toStrictEqual(expectedPolicyData);
      expect(code).toEqual(1);
      expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    });

    it('returns well structured json', async () => {
      const project = await createProjectFromWorkspace(
        'npm-package-single-ignored-vuln',
      );
      server.setCustomResponse(
        await project.readJSON('test-graph-results.json'),
      );

      const { code, stdout } = await runSnykCLI(
        `test -d --json --log-level=trace`,
        {
          cwd: project.path(),
          env,
        },
      );

      try {
        const returnedJson = JSON.parse(stdout);

        expect(returnedJson.vulnerabilities).toHaveLength(0);
        expect(code).toEqual(0);
        expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
      } catch (err) {
        console.log(stdout);
        throw err;
      }
    });
  });
});
