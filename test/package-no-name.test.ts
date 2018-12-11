const test = require('tape');
const snyk = require('../src/lib');

test('packages with no name read dir', async (t) => {
  await snyk.test(__dirname + '/fixtures/package-sans-name');
  t.pass('succeed');
  t.end();
});

test('packages with no name read dir with a lockfile', async (t) => {
  await snyk.test(__dirname + '/fixtures/package-sans-name-lockfile');
  t.pass('succeed');
  t.end();
});
