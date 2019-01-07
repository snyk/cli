var dedupe = require('../src/lib/protect/dedupe-patches');
var test = require('tap').test;
var policy = require('snyk-policy');
var dir = __dirname + '/fixtures/bugs/SC-1076';
var vulns = require(dir + '/vulns.json');

test('protect patches in the correct order - SC-1076', function (t) {
  var res = dedupe(vulns.vulnerabilities);
  t.equal(res.packages[0].id, 'npm:sequelize:20160329', 'latest patch is picked');
  t.equal(res.removed[0].id, 'npm:sequelize:20160115', 'old patch is removed');
  t.pass('ok');
  t.end();
});
