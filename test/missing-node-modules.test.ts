import * as tap from 'tap';
const { test } = tap;
import * as fs from 'then-fs';

const apiKey = '123456789';
const notAuthorizedApiKey = 'notAuthorized';
const port = process.env.PORT || process.env.SNYK_PORT || '12345';
let oldkey;
let oldendpoint;
process.env.SNYK_API = 'http://localhost:' + port + '/api/v1';
process.env.SNYK_HOST = 'http://localhost:' + port;

const baseDir = __dirname + '/fixtures/';

// tslint:disable-next-line:no-var-requires
const server = require('./cli-server')(
  process.env.SNYK_API,
  apiKey,
  notAuthorizedApiKey,
);

// ensure this is required *after* the demo server, since this will
// configure our fake configuration too
import * as cli from '../src/cli/commands';

test('setup', (t) => {
  t.plan(3);
  cli.config('get', 'api').then((key) => {
    oldkey = key; // just in case
    t.pass('existing user config captured');
  });

  cli.config('get', 'endpoint').then((key) => {
    oldendpoint = key; // just in case
    t.pass('existing user endpoint captured');
  });

  server.listen(port, () => {
    t.pass('started demo server');
  });
});

test('throws when missing node_modules', async (t) => {
  const dir = baseDir + 'npm/npm-3-no-node-modules';
  // ensure node_modules does not exist
  try {
    fs.rmdir(dir + '/node_modules');
  } catch (err) {
    // ignore
  }
  // test
  try {
    await cli.test(dir);
    t.fail('should have thrown');
  } catch (e) {
    t.equal(e.code, 500, 'correct error code');
    t.equal(
      e.userMessage,
      "Missing node_modules folder: we can't test without dependencies.\n" +
        "Please run 'npm install' first.",
      'correct error message',
    );
  }
});

test('teardown', (t) => {
  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  server.close(() => {
    t.pass('server shutdown');
    let key = 'set';
    let value = 'api=' + oldkey;
    if (!oldkey) {
      key = 'unset';
      value = 'api';
    }
    cli.config(key, value).then(() => {
      t.pass('user config restored');
      if (oldendpoint) {
        cli.config('endpoint', oldendpoint).then(() => {
          t.pass('user endpoint restored');
          t.end();
        });
      } else {
        t.pass('no endpoint');
        t.end();
      }
    });
  });
});
