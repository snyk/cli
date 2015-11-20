var dotfile = require('../lib/dotfile');
var test = require('tape');

test('test sensibly bails if gets an old .snyk format', function (t) {
  var vulns2 = require('./fixtures/test-jsbin-vulns-updated.json');

  t.plan(1);
  dotfile.load(__dirname + '/fixtures/jsbin-snyk-config').then(function (config) {
    console.log(dotfile.getByVuln(config, 'npm:semver:20150403'));
  }).then(function (res) {
    t.fail('was expecting an error, got ' + JSON.stringify(res));
  }).catch(function (e) {
    t.equal(e.code, 'OLD_DOTFILE_FORMAT');
  });
});