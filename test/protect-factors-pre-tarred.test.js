var test = require('tap').test;
var parser = require('snyk-policy').loadFromText;

test('pre-tarred packages can be ignored', function(t) {
  var res = require(__dirname + '/fixtures/forever.json');
  var text = require('fs').readFileSync(
    __dirname + '/fixtures/policies/forever',
    'utf8',
  );
  return parser(text).then(function(policy) {
    policy.skipVerifyPatch = true;
    var protectedValues = policy.filter(res);

    t.equal(protectedValues.ok, true, 'all vulns have been stripped');
    t.deepEqual(
      protectedValues.vulnerabilities,
      [],
      'all vulns have been stripped',
    );
  });
});
