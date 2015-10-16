var protect = require('../lib/protect');
var test = require('tape');
var vulns = require('./fixtures/test-jsbin-vulns.json');

// skipped intentially - only used for debugging tests
test.skip('protect correctly filters (single)', function (t) {
  t.plan(1);
  Promise.resolve(vulns).then(function (res) {
    function runFilter(path, date) {
      var rule = { 'node-semver-63': [ {} ] };
      rule['node-semver-63'][0][path] = {
        expires: date || new Date(Date.now() + 1000 * 60 * 60 * 24),
        reason: 'none given',
      };

      return protect.filterIgnored(rule, res.vulnerabilities);
    }


    // exact match
    var total = res.vulnerabilities.length;
    var vulns;

    vulns = runFilter('*');
    t.equal(vulns.length, total - 1, 'removed with * _only_ rule');
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
  });
});

test('protect correctly filters', function (t) {
  Promise.resolve(vulns).then(function (res) {
    function runFilter(path, date) {
      var rule = { 'node-semver-63': [ {} ] };
      rule['node-semver-63'][0][path] = {
        expires: date || new Date(Date.now() + 1000 * 60 * 60 * 24),
        reason: 'none given',
      };

      return protect.filterIgnored(rule, res.vulnerabilities);
    }


    // exact match
    var total = res.vulnerabilities.length;
    var vulns;

    vulns = runFilter('sqlite3@2.2.7 > node-pre-gyp@0.5.22 > semver@3.0.1');
    t.equal(vulns.length, total - 1, 'removed matched vuln');

    vulns = runFilter('sqlite3 > node-pre-gyp > semver');
    t.equal(vulns.length, total - 1, 'removed with range (@-less)');

    vulns = runFilter('sqlite3@* > node-pre-gyp@* > semver@*');
    t.equal(vulns.length, total - 1, 'removed with range (with @*)');

    vulns = runFilter('sqlite3@2.2.7 > node-pre-gyp@0.5.22 > semver@3.0.1',
      new Date(Date.now() - (1000 * 60 * 60 * 24)));
    t.equal(vulns.length, total, 'expired rule is ignored');

    vulns = runFilter('* > semver@3.0.1');
    t.equal(vulns.length, total - 1, 'removed with * rule');

    vulns = runFilter('sqlite3 > * > semver@*');
    t.equal(vulns.length, total - 1, 'mixed *, @-less and latest');

    vulns = runFilter('*');
    t.equal(vulns.length, total - 1, 'removed with * _only_ rule');

    vulns = runFilter('sqlite3 > * > semver@5');
    t.equal(vulns.length, total, 'no match');

    t.end();
  }).catch(function (error) {
    console.log(error.stack);
    t.fail(error.stack);
    // t.bailout();
  });
});
