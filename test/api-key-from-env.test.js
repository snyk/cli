var test = require('tap').test;
var key = (process.env.SNYK_TOKEN = '123456');
var snyk = require('../src/lib');

test('api token from env', function(t) {
  t.equal(key, snyk.api, 'current api value env value');
  t.end();
});
