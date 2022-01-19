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

  const { stdout } = await runSnykCLI('advise --acceptableScore=70', {
    cwd: project.path(),
  });

  expect(stdout).not.toMatch(/lodash/);
});

test('filtering packages by maintenance status', async () => {
  const project = await createProjectFromFixture(
    'npm/with-vulnerable-lodash-dep',
  );

  const { stdout } = await runSnykCLI('advise --acceptableMaintenance=Inactive', {
    cwd: project.path(),
  });

  expect(stdout).not.toMatch(/lodash/);
});

test('returns a non-0 code in CI mode when there are issues', async () => {
  const project = await createProjectFromFixture(
    'npm/with-vulnerable-lodash-dep',
  );

  const { code, stdout } = await runSnykCLI('advise --ci', {
    cwd: project.path(),
  });

  expect(code).not.toBe(0);
  expect(stdout).toMatch('lodash');
});

test('specify package.json location', async () => {
  const project = await createProjectFromFixture(
    'npm/with-vulnerable-lodash-dep',
  );

  const { stdout } = await runSnykCLI('advise npm/with-vulnerable-lodash-dep', {
    cwd: project.path().replace('/npm/with-vulnerable-lodash-dep', ''),
  });

  expect(stdout).toMatch('lodash')
})
