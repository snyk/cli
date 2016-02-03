var test = require('tap').test;
var proxyquire = require('proxyquire');
var protect = proxyquire('../lib/protect', {
  'fs': {
    statSync: function () {
      return true;
    }
  }
});
var parser = require('../lib/policy/').loadFromText;
var fs = require('fs');

test('pre-tarred packages can be ignored', function (t) {
  var res = require(__dirname + '/fixtures/forever.json');
  var text = fs.readFileSync(__dirname + '/fixtures/policies/forever', 'utf8');
  parser(text).then(function (policy) {

    var protected = protect.filterPatched(
      policy.patch,
      res.vulnerabilities,
      process.cwd()
    );

    t.equal(protected.length, 0, 'all vulns have been stripped');
  }).catch(t.threw).then(t.end);

});