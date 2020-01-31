const tap = require('tap');
const test = tap.test;
const updateCheck = require('../src/lib/updater').updateCheck;
const fs = require('fs');
const p = require('path');
const sinon = require('sinon').createSandbox();
const updateNotifier = require('@snyk/update-notifier');

// Fake location of the package.json file and verify the code behaves well
test('missing package.json', (t) => {
  const fsStub = sinon.stub(fs, 'existsSync');
  fsStub.withArgs(p.join(__dirname, '../', 'package.json')).returns(false);

  t.tearDown(() => {
    fsStub.restore();
  });

  t.equal(
    updateCheck(),
    false,
    'Notifier was not started on missing package.json',
  );
  t.end();
});

test('STANDALONE declaration present', (t) => {
  const fsStub = sinon.stub(fs, 'existsSync');
  fsStub.withArgs(p.join(__dirname, '../', 'package.json')).returns(true);
  fsStub.withArgs(p.join(__dirname, '../src', 'STANDALONE')).returns(true);

  t.tearDown(() => {
    fsStub.restore();
  });

  t.equal(updateCheck(), false, 'Notifier was not started for binary build');
  t.end();
});

// Run updateNotifier API for the basic package. The target is to verify API still stands
test('verify updater', (t) => {
  const pkg = {
    name: 'snyk',
    version: '1.0.0',
  };
  const notifier = updateNotifier({ pkg });

  t.equal(notifier.packageName, 'snyk', 'Successfull call to notifier');
  t.end();
});
