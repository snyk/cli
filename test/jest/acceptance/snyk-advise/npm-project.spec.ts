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
  expect(stdout).toMatch(/lodash.*[0-9+]{2}.+Sustainable/);
  expect(stderr).toBe('');
})

test('filtering packages by score', async () => {
  const project = await createProjectFromFixture(
    'npm/with-vulnerable-lodash-dep',
  );

  const { stdout } = await runSnykCLI('advise --maxScore=70', {
    cwd: project.path(),
  });

  expect(stdout).not.toMatch(/lodash/);
});
