import * as path from 'path';
import { runCLI } from '../util/runCLI';

jest.setTimeout(1000 * 60 * 5);

describe('snyk test -all-projects should exit with 2 exit code', () => {
  describe('when one of the projects being tested has errors', () => {
    it('and the other has issues (vulnerabilities)', async () => {
      const fixture = path.resolve(
        __dirname,
        '../../fixtures/snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error',
      );
      console.log(fixture);
      const { code, stderr } = await runCLI(`test --all-projects`, fixture);
      expect(code).toEqual(2);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies. Run with `-d` for debug output.',
      );
      expect(stderr).toContain('Failed to read');
      expect(stderr).toContain(
        'test/fixtures/snyk-test-all-projects-exit-codes/project-with-issues-and-project-with-error/project-with-error/package.json. Error: Unexpected token f in JSON at position 3',
      );
    });

    it('and the other has no issues', async () => {
      const fixture = path.resolve(
        __dirname,
        '../../fixtures/snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error',
      );
      console.log(fixture);
      const { code, stderr } = await runCLI(`test --all-projects`, fixture);
      expect(code).toEqual(2);
      expect(stderr).toContain(
        '1/2 potential projects failed to get dependencies. Run with `-d` for debug output.',
      );
      expect(stderr).toContain('Failed to read');
      expect(stderr).toContain(
        'test/fixtures/snyk-test-all-projects-exit-codes/project-with-no-issues-and-project-with-error/project-with-error/package.json. Error: Unexpected token f in JSON at position 3',
      );
    });
  });
});
