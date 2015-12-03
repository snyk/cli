var policy = require('../lib/policy');
var test = require('tape');
var dir1 = __dirname + '/fixtures/qs-package';
var dir2 = __dirname + '/fixtures/qs-package/node_modules/@remy/protect-test';

test('polices merge', function (t) {
  t.plan(2);
  policy.load([dir1, dir2]).then(function (res) {
    t.pass(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
    t.end();
  });
});