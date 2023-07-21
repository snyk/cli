import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { fakeServer } from '../../../acceptance/fake-server';
import {
  createProject,
  createProjectFromWorkspace,
} from '../../util/createProject';
import { runCommand } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';

// Check for existance of pipenv in the environment
const hasPipEnv = spawnSync('pipenv', ['--version']).status === 0;

jest.setTimeout(1000 * 60);
describe('snyk fix', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_OAUTH_TOKEN: 'oauth-jwt-token',
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    await server.listenPromise(apiPort);
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await server.closePromise();
  });

  it('succeeds when there are no vulns to fix', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const { code, stdout, stderr } = await runSnykCLI('fix', {
      cwd: project.path(),
      env,
    });
    expect(code).toBe(0);
    expect(stdout).toMatch('No vulnerable items to fix');
    expect(stderr).toBe('');
  });

  it('fails when FF is not enabled', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const { code, stdout, stderr } = await runSnykCLI('fix --org=no-flag', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(2);
    expect(stdout).toMatch(
      "`snyk fix` is not supported for org 'no-flag'.\nSee documentation on how to enable this beta feature: https://docs.snyk.io/snyk-cli/fix-vulnerabilities-from-the-cli/automatic-remediation-with-snyk-fix#enabling-snyk-fix",
    );
    expect(stderr).toBe('');
  });

  it('fails when called with --unmanaged', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const { code, stdout, stderr } = await runSnykCLI('fix --unmanaged', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(2);
    expect(stdout).toMatch("`snyk fix` is not supported for ecosystem 'cpp'");
    expect(stderr).toBe('');
  });

  it('fails when called with --docker (deprecated)', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const { code, stdout, stderr } = await runSnykCLI('fix --docker', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(2);
    expect(stdout).toMatch(
      "`snyk fix` is not supported for ecosystem 'docker'",
    );
    expect(stderr).toBe('');
  });

  it('fails when called with --code', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const { code, stdout, stderr } = await runSnykCLI('fix --code', {
      cwd: project.path(),
      env,
    });
    expect(code).toEqual(2);
    expect(stdout).toMatch("`snyk fix` is not supported for ecosystem 'code'");
    expect(stderr).toBe('');
  });

  it('fails when api requests fail', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    server.setStatusCode(500);
    const { code, stdout, stderr } = await runSnykCLI(
      'fix --org=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      {
        cwd: project.path(),
        env,
      },
    );
    expect(code).toBe(2);
    expect(stdout).toMatch('No successful fixes');
    expect(stderr).toBe('');
  });

  // Skip this test in environments without pipenv (currently windows & linux
  // docker images).
  (hasPipEnv ? it : it.skip)(
    'runs successfully on a pipenv project',
    async () => {
      const project = await createProject('snyk-fix-pipenv');
      const opts = {
        cwd: project.path(),
        env,
      };

      // Setup environment
      await runCommand('pipenv', ['sync'], opts);

      server.setDepGraphResponse(
        JSON.parse(
          fs.readFileSync(__dirname + '/dep-graph-response.json', 'utf-8'),
        ),
      );

      // Attempt to fix
      const { code, stdout, stderr } = await runSnykCLI('fix', opts);

      // Print some output if we exit with non-zero to help debugging.
      // Jest will just fail on the first error.
      if (code !== 0) {
        console.log(
          `---DEBUG START---code: ${code}\nstdout:\n${stdout}\n\nstderr:\n${stderr}\n---DEBUG END---`,
        );
      }

      // eslint-disable-next-line jest/no-standalone-expect
      expect(code).toBe(0);
      // eslint-disable-next-line jest/no-standalone-expect
      expect(stdout).toMatch(/Upgraded pylint from 2\.6\.0 to 2\.\d+\.\d+/);
      // eslint-disable-next-line jest/no-standalone-expect
      expect(stderr).toBe('');
    },
  );
});
