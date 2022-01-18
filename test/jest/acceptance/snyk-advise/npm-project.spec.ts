import { runSnykCLI } from '../../util/runSnykCLI';

test('exists with 0 code', async () => {
  const { code, stdout, stderr } = await runSnykCLI('advise');

  expect(code).toBe(code);
  expect(stdout).toBe('react - 88 [maintenance:inactive]');
  expect(stderr).toBe('');
})
