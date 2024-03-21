import { runSnykCLI } from '../../util/runSnykCLI';

describe('code', () => {
  it('prints help info', async () => {
    const { stdout, code, stderr } = await runSnykCLI('code');

    expect(stdout).toContain(
      'The snyk code test command finds security issues using Static Code Analysis.',
    );
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  describe('test', () => {
    jest.setTimeout(60000);
    it('supports unknown flags', async () => {
      const { stdout: baselineStdOut } = await runSnykCLI('code test --help');
      const { stdout, stderr } = await runSnykCLI('code test --unknown-flag');

      // We do not render the help message for unknown flags
      expect(stdout).not.toContain(baselineStdOut);
      expect(stdout).toContain('Testing ');
      expect(stderr).toBe('');
    });
  });
});
