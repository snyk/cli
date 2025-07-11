import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(20000);

describe('help', () => {
  it('prints help info', async () => {
    const { stdout, code, stderr } = await runSnykCLI('help');

    expect(stdout).toContain(
      'Snyk CLI scans and monitors your projects for security vulnerabilities',
    );
    expect(code).toBe(0);
    // TODO: Test for stderr when docker issues are resolved
    expect(stderr).toBe('');
  });

  describe('extensive snyk help', () => {
    it('prints help info when called with unknown argument', async () => {
      const { stdout, code, stderr } = await runSnykCLI('help hello');

      expect(stdout).toContain(
        'Snyk CLI scans and monitors your projects for security vulnerabilities',
      );
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    it('prints help info when called with flag and unknown argument', async () => {
      const { stdout, code, stderr } = await runSnykCLI('--help hello');

      expect(stdout).toContain(
        'Snyk CLI scans and monitors your projects for security vulnerabilities',
      );
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    it('prints specific help info for container', async () => {
      const { stdout, code, stderr } = await runSnykCLI('-h container');

      expect(stdout).toContain(
        'test and continuously monitor container images for vulnerabilities',
      );
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    it('prints specific help info for iac', async () => {
      const { stdout, code, stderr } = await runSnykCLI('iac -help');

      expect(stdout).toContain('Infrastructure as Code');
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    it('prints specific help info when called with flag and equals sign', async () => {
      const { stdout, code, stderr } = await runSnykCLI('--help=iac');

      expect(stdout).toContain('Infrastructure as Code');
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    it('prints help info for argument with mode', async () => {
      const { stdout, code, stderr } = await runSnykCLI(
        '--help container test',
      );

      expect(stdout).toContain(
        'tests container images for any known vulnerabilities',
      );
      expect(code).toBe(0);
      // TODO: Test for stderr when docker issues are resolved
      expect(stderr).toBe('');
    });

    describe('prints help info without ascii escape sequences', () => {
      it('has NO_COLOR set', async () => {
        const { stdout, code, stderr } = await runSnykCLI('help', {
          env: {
            ...process.env,
            NO_COLOR: '',
          },
        });

        expect(stdout).not.toContain('[1mN');
        expect(stdout).not.toContain('[0m');
        expect(stdout).not.toContain('[4mC');
        expect(code).toBe(0);
        // TODO: Test for stderr when docker issues are resolved
        expect(stderr).toBe('');
      });

      it('is not tty', async () => {
        // Assuming `runSnykCLI` can pipe output
        const { stdout, code, stderr } = await runSnykCLI('help', {
          stdio: 'pipe',
        });

        expect(stdout).not.toContain('[1mN');
        expect(stdout).not.toContain('[0m');
        expect(stdout).not.toContain('[4mC');
        expect(code).toBe(0);
        // TODO: Test for stderr when docker issues are resolved
        expect(stderr).toBe('');
      });
    });
  });
});
