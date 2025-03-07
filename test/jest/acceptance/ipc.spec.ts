import { runSnykCLI } from '../util/runSnykCLI';

describe('the IPC', () => {
  const env = {
    ...process.env,
  };

  describe('does not sends errors', () => {
    it('for successful runs', async () => {
      const { code, stderr } = await runSnykCLI(
        `test --print-graph ./test/fixtures/npm/with-vulnerable-lodash-dep -d`,
        {
          env,
        },
      );

      expect(code).toEqual(0);
      expect(stderr).not.toContain('Error file contained ');
    });

    it('when vulnerabilities are found', async () => {
      const { code, stderr } = await runSnykCLI(`test semver@2 -d`, {
        env,
      });

      expect(code).toEqual(1);
      expect(stderr).not.toContain('No data was sent through the IPC file.');
      expect(stderr).not.toContain('Error file contained ');
    });

    it('for sarif output', async () => {
      const { code, stderr } = await runSnykCLI(
        `test ./test/fixtures/empty --sarif -d`,
        {
          env,
        },
      );

      // For exit code 2 we will check the IPC file
      expect(code).toEqual(2);
      expect(stderr).toContain('No data was sent through the IPC file.');
      expect(stderr).not.toContain('Error file contained ');
    });
  });

  describe('sends and receives errors', () => {
    it('for no supported files found', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `test ./test/fixtures/empty -d`,
        {
          env,
        },
      );

      expect(code).toEqual(3);
      expect(stdout).toContain('SNYK-CLI-0000');
      expect(stderr).toContain('SNYK-CLI-0000');
      expect(stderr).toContain('Error file contained ');
    });

    it('for errors thrown', async () => {
      const { code, stdout, stderr } = await runSnykCLI(`test ./not_here -d`, {
        env,
      });

      expect(code).toEqual(2);
      expect(stdout).toContain('SNYK-CLI-0000');
      expect(stderr).toContain('SNYK-CLI-0000');
      expect(stderr).toContain('Error file contained ');
    });
  });
});
