const test = require('tape').test;
const zlib = require('zlib');
const requestLib = require('needle');

import * as _ from 'lodash';
import * as sinon from 'sinon';

import * as cli from '../src/cli/commands';
import subProcess = require('../src/lib/sub-process');

test('Make sure that target is sent correctly', async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute');

  subProcessStub.withArgs('git', ['remote', 'get-url', 'origin'])
    .resolves('http://github.com/snyk/project.git');

  subProcessStub.withArgs('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    .resolves('master');

  const { data, spy } = await getMonitorRequestDataAndSpy();

  t.true(spy.calledOnce, 'needle.request was called once');
  t.true(!_.isEmpty(data.target), 'target passed to request');
  t.true(!_.isEmpty(data.targetFileRelativePath), 'targetFileRelativePath passed to request');
  t.equals(data.target.branch, 'master', 'correct branch passed to request');
  t.equals(data.target.remoteUrl, 'http://github.com/snyk/project.git', 'correct name passed to request');
  t.equals(data.targetFileRelativePath, 'package.json', 'correct relative target file path passed to request');

  subProcessStub.restore();
  spy.restore();
  t.end();
});

test('Make sure it\'s not failing monitor for non git projects', async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute').resolves('');
  const { data, spy } = await getMonitorRequestDataAndSpy();

  t.true(spy.calledOnce, 'needle.request was called once');
  t.true(_.isEmpty(data.target), 'empty target passed to request');
  t.equals(data.targetFileRelativePath, 'package.json', 'targetFileRelativePath passed to request');

  subProcessStub.restore();
  spy.restore();
  t.end();
});

test('Make sure it\'s not failing if there is no remote configured', async (t) => {
  const subProcessStub = sinon.stub(subProcess, 'execute').rejects();
  const { data, spy } = await getMonitorRequestDataAndSpy();

  t.true(spy.calledOnce, 'needle.request was called once');
  t.true(_.isEmpty(data.target), 'empty target passed to request');
  t.equals(data.targetFileRelativePath, 'package.json', 'targetFileRelativePath passed to request');

  subProcessStub.restore();
  spy.restore();
  t.end();
});

async function getMonitorRequestDataAndSpy() {
  const requestSpy = sinon.spy(requestLib, 'request');

  await cli.monitor();

  const data = JSON.parse(zlib.gunzipSync(requestSpy.getCall(0).args[2]).toString());

  return {
    data,
    spy: requestSpy,
  };
}
