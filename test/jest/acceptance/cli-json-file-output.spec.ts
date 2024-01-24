import { fakeServer } from '../../acceptance/fake-server';
import * as fs from 'fs';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

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
    const reference = response.result.issuesData["SNYK-ALPINE319-OPENSSL-6148881"].references[0];
    response.result.issuesData["SNYK-ALPINE319-OPENSSL-6148881"].references = new Array(2 * 1024 * 1024)
      .fill(reference);

    server.setCustomResponse(response);

    const { code } = await runSnykCLI(
      `container test alpine:latest --json-file-output=${outputFilename}`,
      {
        cwd: project.path(),
        env,
      },
    );

    const outputPath = await project.path(outputFilename);
    expect(code).toEqual(1);
    console.log({
      outputPath,
      outputPathSize: humanFileSize(fs.statSync(outputPath).size),
    });
    expect(fs.statSync(outputPath).size).toBeGreaterThan(2200000000); // ~2GB
  });
});

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
}
