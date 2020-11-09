import { fakeServer } from './acceptance/fake-server';
import * as cli from './../src/cli/commands';

async function createFakeServer() {
  const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
  const BASE_API = '/api/v1';
  process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
  process.env.SNYK_HOST = 'http://localhost:' + port;
  process.env.LOG_LEVEL = '0';
  const apiKey = '123456789';
  const server = fakeServer(BASE_API, apiKey);
  let key = await cli.config('get', 'api');
  const oldkey = key;
  key = await cli.config('get', 'endpoint');
  const oldendpoint = key;
  await new Promise((resolve) => server.listen(port, resolve));
  await cli.config('set', 'api=' + apiKey);
  await cli.config('unset', 'endpoint');
  return {
    server,
    async teardown() {
      delete process.env.SNYK_API;
      delete process.env.SNYK_HOST;
      delete process.env.SNYK_PORT;
      await new Promise((resolve) => server.close(resolve));
      let teardownKey = 'set';
      let value = 'api=' + oldkey;
      if (!oldkey) {
        teardownKey = 'unset';
        value = 'api';
      }
      await cli.config(teardownKey, value);
      if (oldendpoint) {
        await cli.config('endpoint', oldendpoint);
      }
    },
  };
}

describe('Acceptance suite', () => {
  let globalTeardown;
  let globalServer;
  beforeAll(async () => {
    const { server, teardown } = await createFakeServer();
    globalServer = server;
    globalTeardown = teardown;
  });

  afterAll(async () => await globalTeardown());

  test('print-deps suite', async () => {
    const response = await cli.test('print-deps', {
      'quiet': true,
      'json': true,
      'print-deps': true,
    });
    console.log(response);
    expect(response).toEqual(2);
  });
});
