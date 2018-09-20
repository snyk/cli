var test = require('tape');
var proxyquire = require('proxyquire');

test('snyk required', function (t) {
  var snyk = proxyquire('../src/lib', {});
  snyk({
    api: '123456',
    id: '__test__',
    monitor: true,
  });

  setTimeout(function () {
    t.pass('done');
    t.end();
  }, 2000);
});