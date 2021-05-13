import {
  chdirWorkspaces,
  getWorkspaceJSON,
} from '../../acceptance/workspace-helper';
import { fakeServer } from '../../acceptance/fake-server';
import cli = require('../../../src/cli/commands');

describe('test using OAuth token', () => {
  let oldkey: string;
  let oldendpoint: string;
  const apiKey = '123456789';
  const port: string = process.env.PORT || process.env.SNYK_PORT || '12345';

  const BASE_API = '/api/v1';

  const server = fakeServer(BASE_API, apiKey);

  const noVulnsResult = getWorkspaceJSON(
    'fail-on',
    'no-vulns',
    'vulns-result.json',
  );

  beforeAll(async () => {
    process.env.SNYK_API = `http://localhost:${port}${BASE_API}`;
    process.env.SNYK_HOST = `http://localhost:${port}`;

    let key = await cli.config('get', 'api');
    oldkey = key;

    key = await cli.config('get', 'endpoint');
    oldendpoint = key;

    await new Promise((resolve) => {
      server.listen(port, resolve);
    });
  });

  afterAll(async () => {
    delete process.env.SNYK_API;
    delete process.env.SNYK_HOST;
    delete process.env.SNYK_PORT;
    delete process.env.SNYK_OAUTH_TOKEN;

    await server.close();
    let key = 'set';
    let value = `api=${oldkey}`;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    await cli.config(key, value);
    if (oldendpoint) {
      await cli.config('endpoint', oldendpoint);
    }
  });

  it('successfully tests a project with an OAuth env variable set', async () => {
    process.env.SNYK_OAUTH_TOKEN = 'oauth-jwt-token';

    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.test('no-vulns', {
      json: true,
    });
    const req = server.popRequest();
    expect(req.headers.authorization).toBe('Bearer oauth-jwt-token');
    expect(req.method).toBe('POST');
  });

  it('successfully monitors a project with an OAuth env variable set', async () => {
    process.env.SNYK_OAUTH_TOKEN = 'oauth-jwt-token';

    server.setNextResponse(noVulnsResult);
    chdirWorkspaces('fail-on');
    await cli.monitor('no-vulns', {
      json: true,
    });
    const req = server.popRequest();
    expect(req.headers.authorization).toBe('Bearer oauth-jwt-token');
    expect(req.method).toBe('PUT');
  });
});
