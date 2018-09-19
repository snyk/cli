var test = require('tap').test;
var proxyquire = require('proxyquire');

var hasPatch = true;
var analyticsEvent;

var ensurePatchExists = proxyquire('../lib/protect/ensure-patch', {
  hasbin: function (_, cb) {
    cb(hasPatch);
  },
  '../analytics': {
    add: function (type, data) {
      analyticsEvent = {
        type: type,
        data: data,
      };
    },
  },
});

test('Ensure patch works when patch exists', t => {
  t.plan(1);
  ensurePatchExists().then(t.pass).catch(t.fail);
});

test('Ensure patch throws when patch does not exist', t => {
  t.plan(2);
  hasPatch = false;
  ensurePatchExists()
    .then(t.fail)
    .catch(() => {
      t.is(analyticsEvent.type, 'patch-binary-missing');
      t.ok(analyticsEvent.data.message.indexOf('GNU') > -1);
    });
});
