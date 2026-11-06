import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 300);

const LOG_TAG = '[monitor-all-projects-user-journey]';

const env = {
  ...process.env,
  SNYK_API: process.env.TEST_SNYK_API_DEV,
  SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
  INTERNAL_SNYK_CLI_ROLLOUT_DFLY_OS_CLI: 'true',
};

const describeIfPreProd = process.env.TEST_SNYK_TOKEN_DEV
  ? describe
  : describe.skip;

describeIfPreProd('snyk monitor --all-projects', () => {
  it('monitors every project in a multi-project repo', async () => {
    const project = await createProjectFromWorkspace(
      'npm-package-with-subfolder',
    );

    const command = 'monitor --all-projects -d';
    console.log(`${LOG_TAG} running: snyk ${command}`);

    const { code, stdout, stderr } = await runSnykCLI(command, {
      env,
      cwd: project.path(),
    });

    console.log(`${LOG_TAG} exit code: ${code}`);
    console.log(`${LOG_TAG} stdout:\n${stdout}`);
    console.log(`${LOG_TAG} stderr:\n${stderr}`);

    expect(code).toBe(0);
    expect(stdout).toMatch(/\/org\/[^/\s]+\/project\//);
    expect(stdout).toContain('npm-package-top-level');
    expect(stdout).toContain('npm-package-subfolder');
    expect(stderr).toContain('invoking ecosystems orchestrator');
  });
});
