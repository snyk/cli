var test = require('tape');
var snyk = require('../src/lib');

test('packages with no name read dir', function (t) {
  t.plan(1);
  snyk.test(__dirname + '/fixtures/package-sans-name').then(function () {
    t.pass('succeed');
  }).catch(function (e) {
    t.fail('Failed with: ' + e.message);
  });
});