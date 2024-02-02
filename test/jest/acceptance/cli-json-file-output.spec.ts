import { fakeServer } from '../../acceptance/fake-server';
import * as fs from 'fs';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';
import { humanFileSize } from '../../utils';

jest.setTimeout(1000 * 60);

describe('test --json-file-output', () => {
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

  it('can save JSON output to file while sending human readable output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `test --json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toMatch('Organization:');
    expect(await project.readJSON(outputPath)).toMatchObject({ ok: true });
  });

  it('test --json-file-output produces same JSON output as normal JSON output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `test --json --json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );
    expect(code).toEqual(0);
    expect(await project.read(outputPath)).toEqual(stdout);
  });

  it('test --json-file-ouput handles responses larger than 512Mb string size limit in v8', async () => {
    const project = await createProjectFromWorkspace(
      'extra-large-response-payload',
    );
    const outputFilename = 'json-file-output.json';
    const response = await project.readJSON('vulns-result.json');
    const reference =
      response.result.issuesData['SNYK-ALPINE319-OPENSSL-6148881']
        .references[0];
    response.result.issuesData[
      'SNYK-ALPINE319-OPENSSL-6148881'
    ].references = new Array(420000).fill(reference);

    server.setCustomResponse(response);

    const { code, stdout, stderr } = await runSnykCLI(
      `container test hello-world:latest --json-file-output=${outputFilename}`,
      {
        cwd: project.path(),
        env,
      },
    );

    console.debug({ stdout, stderr });
    expect(code).toEqual(1);

    const outputPath = await project.path(outputFilename);
    const fileSize = fs.statSync(outputPath).size;

    console.info({
      outputPath,
      outputPathSize: humanFileSize(fileSize),
    });
    expect(fileSize).toBeGreaterThan(500000000); // ~0.5GB
  }, 120000);

  it('test --json-file-ouput does not write an empty file if no issues are found', async () => {
    const project = await createProjectFromWorkspace('golang-gomodules');
    const outputFilename = project.path() + '/shouldnt_be_there.json';

    const { code } = await runSnykCLI(
      `code test --json-file-output=${outputFilename} ${project.path()}`,
    );

    const fileExists = fs.existsSync(outputFilename);
    expect(fileExists).toBeFalsy();
    expect(code).toEqual(0);
  });
});
