import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

test('returns value in one line', async () => {
  const expectedToken = 'my-test-token';

  const { code, stdout } = await runSnykCLI('config get api', {
    env: {
      ...process.env,
      SNYK_CFG_API: expectedToken,
    },
  });
  expect(code).toEqual(0);
  expect(stdout).toEqual(expectedToken + '\n');
});
