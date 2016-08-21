var test = require('tap-only');
var proxyquire = require('proxyquire');

var hasPatch = true;

var ensurePatchExists = proxyquire('../lib/protect/ensure-patch', {
  hasbin: function (_, cb) {
    cb(hasPatch);
  },
});

test('Ensure patch works when patch exists', t => {
  t.plan(1);
  ensurePatchExists().then(t.pass).catch(t.fail);
});

test('Ensure patch throws when patch does not exist', t => {
  t.plan(1);
  hasPatch = false;
  ensurePatchExists().then(t.fail).catch(t.pass);
});
