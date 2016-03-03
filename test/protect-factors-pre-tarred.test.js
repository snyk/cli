var test = require('tap').test;
var proxyquire = require('proxyquire');
var parser = require('../lib/policy/').loadFromText;
var fs = {
  statSync: function () {
    return true;
  }
};
var protect = proxyquire('../lib/protect', {
  'fs': fs,
  './get-vuln-source': proxyquire('../lib/protect/get-vuln-source', { fs: fs })
});

test('pre-tarred packages can be ignored', function (t) {
  var res = require(__dirname + '/fixtures/forever.json');
  var text = require('fs').readFileSync(__dirname + '/fixtures/policies/forever', 'utf8');
  return parser(text).then(function (policy) {

    var protected = protect.filterPatched(
      policy.patch,
      res.vulnerabilities,
      process.cwd()
    );

    t.equal(protected.length, 0, 'all vulns have been stripped');
  });
});