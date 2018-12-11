const tap = require('tap');
const test = tap.test;
const updateCheck = require('../src/lib/updater').updateCheck;
const path = require('path');
const sinon = require('sinon').createSandbox();
const updateNotifier = require('update-notifier');

// Fake location of the package.json file and verify the code behaves well
test('missing package.json', (t) => {
  t.plan(1);
  let resolveStub = sinon.stub(path, 'resolve');
  resolveStub.onFirstCall().returns('falseDir');
  resolveStub.onSecondCall().returns('falseFile');

  t.tearDown(() => {
    resolveStub.restore();
  });

  t.equal(updateCheck(), false, 'Notifier was not started on missing package.json');
  t.end();
});

// Run updateNotifier API for the basic package. THe target is to verify API still stands
test('verify updater', (t) => {
   var pkg = {
    name: 'snyk',
    version: '1.0.0'
  };
  const notifier = updateNotifier({pkg});

  t.equal(notifier.packageName, 'snyk', 'Successfull call to notifier');
  t.end();
});
