import { createCLITestHarness } from '../util/snyk-cli-test-harness';

jest.setTimeout(1000 * 60 * 5);

describe('snyk test -all-projects with one project that has errors', () => {
  describe('and another that has issues (vulnerabilities)', () => {
    it('should exit with exit code 1', async () => {
      const test = createCLITestHarness(
        'snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error',
      );
      const { code, stderr } = await test.test();
      expect(code).toEqual(1);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies. Run with `-d` for debug output.',
      );
    });
  });

  describe('and another has no issues (vulnerabilities)', () => {
    // note: actually, this is a bug. It should really have exit code 2, but that is a big change that we need to do
    it('should exit with exit code 0', async () => {
      const test = createCLITestHarness(
        'snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );
      const { code, stderr } = await test.test();
      expect(code).toEqual(0);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies. Run with `-d` for debug output.',
      );
    });
  });
});
