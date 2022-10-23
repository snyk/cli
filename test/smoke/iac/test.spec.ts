import { run } from '../../jest/acceptance/iac/helpers';

jest.setTimeout(1_000 * 120);

function runWrapper(cmd: string) {
  return run(cmd, {
    PATH: process.env.PATH ?? '',
  });
}

async function login() {
  await runWrapper(`snyk auth ${process.env.IAC_SMOKE_TESTS_SNYK_TOKEN}`);
}

const SNYK_ORG = 'snyk-cloud-tests';

describe('snyk iac test', () => {
  beforeAll(async () => {
    await login();
  });

  it('runs successfully and resolves with a non-error exit code', async () => {
    // Arrange
    const filePath = 'iac/depth_detection/root.tf';

    // Act
    const { stdout, exitCode } = await runWrapper(
      `snyk iac test ${filePath} --org=${SNYK_ORG}`,
    );

    // Assert
    expect(stdout).toContain('Infrastructure as Code');
    expect(stdout).toContain('Test completed');
    expect(exitCode).toBeLessThan(2);
  });

  it('Share Results successfully and resolves with a non-error exit code', async () => {
    // Arrange
    const filePath = 'iac/depth_detection/root.tf';

    // Act
    const { stdout, exitCode } = await runWrapper(
      `snyk iac test ${filePath} --org=${SNYK_ORG} --report`,
    );

    // Assert
    expect(stdout).toContain('Infrastructure as Code');
    expect(stdout).toContain('Test completed');
    expect(stdout).toContain('Report Complete');
    expect(stdout).toContain(
      `Your test results are available at: https://snyk.io/org/${SNYK_ORG}/cloud/issues?environment_name=fixtures`,
    );
    expect(exitCode).toBeLessThan(2);
  });
});
