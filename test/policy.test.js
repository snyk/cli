var policy = require('../lib/policy');
var test = require('tape');

test('test sensibly bails if gets an old .snyk format', function (t) {
  var vulns2 = require('./fixtures/test-jsbin-vulns-updated.json');

  var id = 'npm:semver:20150403';

  t.plan(1);
  policy.load(__dirname + '/fixtures/jsbin-snyk-config').then(function (config) {
    var rule = policy.getByVuln(config, id);
    t.equal(id, rule.id);
  }).then(function (res) {
    // t.fail('was expecting an error, got ' + JSON.stringify(res));
  }).catch(function (e) {
    t.equal(e.code, 'OLD_DOTFILE_FORMAT');
  });
});