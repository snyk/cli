var policy = require('../lib/policy');
var test = require('tape');

test('test sensibly bails if gets an old .snyk format', function (t) {
  var vulns = require('./fixtures/test-jsbin-vulns-updated.json').vulnerabilities;
  var id = 'npm:semver:20150403';
  var vuln = vulns.filter(function (v) {
    return v.id === id;
  }).pop();

  policy.load(__dirname + '/fixtures/jsbin-snyk-config').then(function (config) {
    var rule = policy.getByVuln(config, vuln);
    t.equal(id, rule.id);
    t.equal(rule.type, 'ignore', 'rule is correctly flagged as ignore');

    var notfound = policy.getByVuln(config, 'unknown');
    t.equal(notfound, null, 'unknown policies are null');
    t.end();
  }).catch(function (e) {
    console.log(e.stack);
    t.fail('could not load the policy file');
    t.end();
  });
});