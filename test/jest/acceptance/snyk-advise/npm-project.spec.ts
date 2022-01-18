import { runSnykCLI } from '../../util/runSnykCLI';
import { createProjectFromFixture } from '../../util/createProject';

test('lists advisor scores for dependencies', async () => {
  const project = await createProjectFromFixture(
    'npm/with-vulnerable-lodash-dep',
  );

  const { code, stdout, stderr } = await runSnykCLI('advise', {
    cwd: project.path(),
  });

  expect(code).toBe(0);
  expect(stdout).toMatch('lodash: 88');
  expect(stderr).toBe('');
})
