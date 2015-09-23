'use strict';
var snyk = require('..');
var protect = require('../lib/protect');
var test = require('tape');
var vulns = require('./fixtures/test-jsbin-vulns.json');

test('protect correctly filters', function (t) {
  Promise.resolve(vulns).then(function (res) {
    function runFilter(rule, date) {
      return protect.filterIgnored({
        'node-semver-63': {
          expires: date || new Date(Date.now() + 1000 * 60 * 60 * 24),
          path: [rule],
        },
      }, res.vulnerabilities);
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

test('protect generates detailed ignore format', function (t) {
  t.plan(2);

  var save = snyk.dotfile.save;
  Promise.resolve(vulns).then(function (res) {
    var vulns = res.vulnerabilities.filter(function (vuln) {
      return (vuln.name === 'semver' && vuln.version === '3.0.1');
    });

    t.equal(vulns.length, 1, 'narrowed to test vuln');


    var vuln = vulns[0];
    var expect = { ignore: {} };

    expect.ignore[vuln.id] = {
      path: [vuln.from.slice(1).join(' > ')],
    };

    snyk.dotfile.save = function (res) {
      // copy the time across since it can be out by a microsecond...
      expect.ignore[vuln.id].expires = res.ignore[vuln.id].expires;
      // loose required as date doesn't yeild equality.
      t.deepLooseEqual(res, expect, 'dotfile format is correct');
    };

    return protect.ignore(vulns);
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
  }).then(function () {
    // restore
    snyk.dotfile.save = save;
  });
});