var test = require('tap').test;
var proxyquire = require('proxyquire');
var analyticsEvent;

var getPatchFile = proxyquire('../src/lib/protect/fetch-patch', {
  fs: {
    writeFileSync: function() {},
  },
  '../analytics': {
    add: function(type, data) {
      analyticsEvent = { type, data };
    },
  },
});

test('Fetch does what it should when request works properly', (t) => {
  return getPatchFile('http://httpstat.us/200', 'name')
    .then((name) => t.is(name, 'name'))
    .catch(() => t.fail('Rejected'));
});

test('Fetch fails with 404', (t) => {
  return getPatchFile('http://httpstat.us/404', 'name')
    .then(() => t.fail('Should have failed'))
    .catch(() => {
      t.is(analyticsEvent.type, 'patch-fetch-fail', 'proper analytics type');
      t.is(analyticsEvent.data.code, 404, 'proper analytics data code');
    });
});

test('Fetch fails with 502', (t) => {
  return getPatchFile('http://httpstat.us/502', 'name')
    .then(() => t.fail('Should have failed'))
    .catch(() => {
      t.is(analyticsEvent.type, 'patch-fetch-fail', 'proper analytics type');
      t.is(analyticsEvent.data.code, 502, 'proper analytics data code');
    });
});
