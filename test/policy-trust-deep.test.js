var test = require('tap').test;
var Promise = require('es6-promise').Promise; // jshint ignore:line
var cli = require('../cli/commands');
var dir = __dirname + '/fixtures/qs-package';

test('`snyk test` sees suggested ignore policies', function (t) {
  return cli.test(dir).catch(function (res) {
    var vulns = res.message.toLowerCase();
    t.notEqual(vulns.indexOf('suggests ignoring this issue, with reason: test trust policies'), -1, 'found suggestion to ignore');
    t.equal(count('vulnerability found', vulns), 5, 'all 4 vulns found');
  });
});

test('`snyk test` ignores when applying `--trust-policies`', function (t) {
  return cli.test(dir, { 'trust-policies': true }).catch(function (res) {
    var vulns = res.message.trim();
    // note: it's 2 vulns + the summary line
    t.equal(count('vulnerability found', vulns), 3, 'only 3 vulns left');
  });
});

function count(needle, haystack) {
  return (haystack.toLowerCase().match(new RegExp(needle.toLowerCase(), 'g')) ||
   []).length;
}
