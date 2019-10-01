var policy = require('snyk-policy');
var test = require('tape');

test('test sensibly bails if gets an old .snyk format', function(t) {
  var vulns2 = require('./fixtures/test-jsbin-vulns-updated.json');
  var policy = require('snyk-policy');

  t.plan(1);
  policy
    .load(__dirname + '/fixtures/old-snyk-config')
    .then(function(config) {
      return config.filter(vulns2);
    })
    .then(function(res) {
      t.fail('was expecting an error, got ' + JSON.stringify(res));
    })
    .catch(function(e) {
      t.equal(e.code, 'OLD_DOTFILE_FORMAT');
    });
});
