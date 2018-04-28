var test = require('tap').test;
var runtime = require('../cli/runtime');

test('nodejs runtime versions support ', function (t) {
  t.ok(runtime.isSupported(process.versions.node),
    'Current runtime is supported');
  t.notOk(runtime.isSupported('0.10.48'), '0.10 is not supported');
  t.notOk(runtime.isSupported('0.12.18'), '0.12 is not supported');
  t.end();
});
