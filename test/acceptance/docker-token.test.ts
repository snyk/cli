import * as tap from 'tap';
import * as cli from '../../src/cli/commands';
import { fakeServer } from './fake-server';
import * as sinon from 'sinon';

const { test } = tap;

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
const BASE_API = '/api/v1';
process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
const apiKey = '123456789';
let oldkey;
let oldendpoint;
const server = fakeServer(BASE_API, apiKey);

// This import needs to come after the server init
// it causes the configured API url to be incorrect.
import * as plugins from '../../src/lib/ecosystems/plugins';

test('setup', async (t) => {
  t.plan(3);

  let key = await cli.config('get', 'api');
  oldkey = key;
  t.pass('existing user config captured: ' + oldkey);

  key = await cli.config('get', 'endpoint');
  oldendpoint = key;
  t.pass('existing user endpoint captured: ' + oldendpoint);

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });
  t.pass('started demo server');
  t.end();
});

test('prime config', async (t) => {
  await cli.config('unset', 'endpoint');
  t.pass('endpoint removed');

  await cli.config('unset', 'api');
  t.pass('api key removed');

  process.env.SNYK_DOCKER_TOKEN = 'docker-jwt-token';
  t.pass('docker token set');

  t.end();
});

test('`snyk test` with docker flag - docker token and no api key', async (t) => {
  stubDockerPluginResponse(
    plugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );
  try {
    await cli.test('foo:latest', {
      docker: true,
    });
    const req = server.popRequest();
    t.match(
      req.headers.authorization,
      'Bearer docker-jwt-token',
      'sends correct authorization header',
    );
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, 'docker-jwt/test-dependencies', 'posts to correct url');
  } catch (err) {
    if (err.code === 401) {
      t.fail('did not send correct autorization header');
      t.end();
    }
    t.fail('did not expect exception to be thrown ' + err);
  }
});

test('`snyk test` with docker flag - docker token and api key', async (t) => {
  stubDockerPluginResponse(
    plugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );
  await cli.config('set', 'api=' + apiKey);
  try {
    await cli.test('foo:latest', {
      docker: true,
    });
    const req = server.popRequest();
    t.equal(req.method, 'POST', 'makes POST request');
    t.match(req.url, '/test-dependencies', 'posts to correct url');
  } catch (err) {
    t.fail('did not expect exception to be thrown ' + err);
  }
  await cli.config('unset', 'api');
  t.end();
});

test('`snyk test` without docker flag - docker token and no api key', async (t) => {
  stubDockerPluginResponse(
    plugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );
  try {
    await cli.test('foo:latest', {
      docker: false,
    });
    t.fail('expected MissingApiTokenError');
  } catch (err) {
    t.equal(err.name, 'MissingApiTokenError', 'should throw if not docker');
  }
});

test('`snyk test` with docker flag - displays CTA', async (t) => {
  stubDockerPluginResponse(
    plugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );
  const vulns = require('./fixtures/docker/find-result.json');
  server.setNextResponse(vulns);

  try {
    await cli.test('foo:latest', {
      docker: true,
    });
  } catch (err) {
    const msg = err.message;
    t.match(
      msg,
      'For more free scans that keep your images secure, sign up to Snyk at https://dockr.ly/3ePqVcp',
      'displays docker CTA for scan with vulns',
    );
  }
});

test('`snyk test` with docker flag - does not display CTA', async (t) => {
  stubDockerPluginResponse(
    plugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );
  const vulns = require('./fixtures/docker/find-result.json');
  server.setNextResponse(vulns);
  await cli.config('set', 'api=' + apiKey);
  try {
    await cli.test('foo:latest', {
      docker: true,
    });
  } catch (err) {
    const msg = err.message;
    t.notMatch(
      msg,
      'For more free scans that keep your images secure, sign up to Snyk at https://dockr.ly/3ePqVcp',
      'does not display docker CTA if API key was used',
    );
  }
  await cli.config('unset', 'api');
  t.end();
});

test('teardown', async (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  delete process.env.SNYK_DOCKER_TOKEN;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  await new Promise((resolve) => {
    server.close(resolve);
  });
  t.pass('server shutdown');

  if (!oldkey) {
    await cli.config('unset', 'api');
  } else {
    await cli.config('set', 'api=' + oldkey);
  }

  if (oldendpoint) {
    await cli.config('set', `endpoint=${oldendpoint}`);
    t.pass('user endpoint restored');
  } else {
    t.pass('no endpoint');
  }
  t.pass('user config restored');
  t.end();
});

function stubDockerPluginResponse(plugins, fixture: string | object, t) {
  const plugin = {
    async scan(_) {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
    async display() {
      return '';
    },
  };
  const spyPlugin = sinon.spy(plugin, 'scan');
  const loadPlugin = sinon.stub(plugins, 'getPlugin');
  loadPlugin.withArgs(sinon.match.any).returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}
