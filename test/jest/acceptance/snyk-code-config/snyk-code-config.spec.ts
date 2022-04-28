import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

test('it does not enable base64 encoding by default', async () => {
  const { code, stdout } = await runSnykCLI('config get use-base64-encoding', {
    env: {
      ...process.env,
    },
  });
  expect(code).toEqual(0);
  expect(stdout).toEqual('');
});
