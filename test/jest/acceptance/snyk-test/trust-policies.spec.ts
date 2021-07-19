import { createProject } from '../../util/createProject';
import { requireSnykToken } from '../../util/requireSnykToken';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

test('`snyk test` detects suggested ignore policies', async () => {
  const project = await createProject('qs-package');
  const { code, stdout } = await runSnykCLI('test', {
    cwd: project.path(),
    env: {
      ...process.env,
      SNYK_TOKEN: requireSnykToken(),
    },
  });

  expect(code).toEqual(1);
  expect(stdout).toMatch(
    'suggests ignoring this issue, with reason: test trust policies',
  );
  expect(stdout).toMatch('npm:hawk:20160119');
  expect(stdout).toMatch('npm:request:20160119');
});

test('`snyk test --trust-policies` applies suggested ignore policies', async () => {
  const project = await createProject('qs-package');
  const { code, stdout } = await runSnykCLI('test --trust-policies', {
    cwd: project.path(),
    env: {
      ...process.env,
      SNYK_TOKEN: requireSnykToken(),
    },
  });

  expect(code).toEqual(1);
  expect(stdout).not.toMatch(
    'suggests ignoring this issue, with reason: test trust policies',
  );
  expect(stdout).not.toMatch('npm:hawk:20160119');
  expect(stdout).not.toMatch('npm:request:20160119');
});
