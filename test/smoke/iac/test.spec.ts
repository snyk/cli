import { run } from '../../jest/acceptance/iac/helpers';

jest.setTimeout(1_000 * 90);

describe('snyk iac test', () => {
  beforeAll(async () => {
    await login();
  });

  it('runs successfully and resolves with a non-error exit code', async () => {
    // Arrange
    const filePath = 'iac/depth_detection/root.tf';

    // Act
    const { stderr, stdout, exitCode } = await run(`snyk iac test ${filePath}`);

    // Assert
    expect(stdout).toContain('Infrastructure as Code');
    expect(stderr).toBe('');
    expect(exitCode).toBeLessThan(2);
  });

  async function login() {
    await run(`snyk auth ${process.env.IAC_SMOKE_TESTS_SNYK_TOKEN}`);
  }
});
