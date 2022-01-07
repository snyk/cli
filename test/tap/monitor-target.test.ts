import { test } from 'tap';
import * as requestLib from 'needle';
import * as path from 'path';

const isEmpty = require('lodash.isempty');
import * as sinon from 'sinon';

import * as cli from '../../src/cli/commands';
import subProcess = require('../../src/lib/sub-process');
import { fakeServer } from '../acceptance/fake-server';

const apiKey = '123456789';

const port = (process.env.PORT = process.env.SNYK_PORT = '12345');
const BASE_API = '/api/v1';
process.env.SNYK_API = 'http://localhost:' + port + BASE_API;
process.env.SNYK_HOST = 'http://localhost:' + port;
process.env.LOG_LEVEL = '0';
let oldkey;
let oldendpoint;
const server = fakeServer(BASE_API, apiKey);

test('setup', async (t) => {
  let key = await cli.config('get', 'api');
  oldkey = key;
  t.pass('existing user config captured');

  key = await cli.config('get', 'endpoint');
  oldendpoint = key;
  t.pass('existing user endpoint captured');

  await new Promise((resolve) => {
    server.listen(port, resolve);
  });
  t.pass('started demo server');
});

test('Make sure that target is sent correctly', async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute');
  const requestSpy = sinon.spy(requestLib, 'request');

  subProcessStub
    .withArgs('git', ['remote', 'get-url', 'origin'])
    .resolves('http://github.com/snyk/project.git');

  subProcessStub
    .withArgs('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    .resolves('master');

  const { data } = await getFakeServerRequestBody();
  t.true(requestSpy.calledOnce, 'needle.request was not called once');
  t.true(!isEmpty(data.target), 'target passed to request');
  t.true(
    !isEmpty(data.targetFileRelativePath),
    'targetFileRelativePath passed to request',
  );
  t.equals(data.target.branch, 'master', 'correct branch passed to request');
  t.equals(
    data.target.remoteUrl,
    'http://github.com/snyk/project.git',
    'correct name passed to request',
  );
  t.match(
    data.targetFileRelativePath,
    'snyk' + path.sep + 'package-lock.json',
    'correct relative target file path passed to request',
  );

  subProcessStub.restore();
  requestSpy.restore();
});

test("Make sure it's not failing monitor for non git projects", async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute');
  const requestSpy = sinon.spy(requestLib, 'request');
  const { data } = await getFakeServerRequestBody();

  t.true(requestSpy.calledOnce, 'needle.request was not called once');
  t.true(isEmpty(data.target), 'empty target passed to request');
  t.match(
    data.targetFileRelativePath,
    'snyk' + path.sep + 'package-lock.json',
    'targetFileRelativePath passed to request',
  );

  subProcessStub.restore();
  requestSpy.restore();
});

test("Make sure it's not failing if there is no remote configured", async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute');
  const requestSpy = sinon.spy(requestLib, 'request');
  const { data } = await getFakeServerRequestBody();

  t.true(requestSpy.calledOnce, 'needle.request was not called once');
  t.true(isEmpty(data.target), 'empty target passed to request');
  t.match(
    data.targetFileRelativePath,
    'snyk' + path.sep + 'package-lock.json',
    'targetFileRelativePath passed to request',
  );
  subProcessStub.restore();
  requestSpy.restore();
});

test('teardown', async (t) => {
  t.plan(4);

  delete process.env.SNYK_API;
  delete process.env.SNYK_HOST;
  delete process.env.SNYK_PORT;
  t.notOk(process.env.SNYK_PORT, 'fake env values cleared');

  await new Promise<void>((resolve) => {
    server.close(resolve);
  });
  t.pass('server shutdown');
  let key = 'set';
  let value = 'api=' + oldkey;
  if (!oldkey) {
    key = 'unset';
    value = 'api';
  }
  await cli.config(key, value);
  t.pass('user config restored');
  if (oldendpoint) {
    await cli.config('endpoint', oldendpoint);
    t.pass('user endpoint restored');
    t.end();
  } else {
    t.pass('no endpoint');
    t.end();
  }
});

async function getFakeServerRequestBody() {
  await cli.monitor();
  const req = server.popRequest();
  const body = req.body;

  return {
    data: body,
  };
}
