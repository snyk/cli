'use strict';
var snyk = require('..');
var protect = require('../lib/protect');
var test = require('tape');

test('protect generates detailed ignore format', function (t) {
  t.plan(2);

  var save = snyk.dotfile.save;
  snyk.dotfile.save = function (string) {
    t.equal(string, 'remy', 'dotfile format is correct');

    // restore
    snyk.dotfile.save = save;
  };

  snyk.test('jsbin@3.11.23').then(function (res) {
    var vulns = res.vulnerabilities.filter(function (vuln) {
      return (vuln.name === 'semver' && vuln.version === '3.0.1');
    });

    t.equal(vulns.length, 1, 'narrowed to test vuln');

    protect.ignore(vulns);
  }).catch(function (e) {
    t.fail(e);
  });
});