'use strict';
var snyk = require('..');
var protect = require('../lib/protect');
var test = require('tape');
var vulns = require('./fixtures/test-jsbin-vulns.json');

test('protect generates detailed ignore format', function (t) {
  t.plan(2);

  var save = snyk.dotfile.save;
  Promise.resolve(vulns).then(function (res) {
    var vulns = res.vulnerabilities.filter(function (vuln) {
      return (vuln.name === 'semver' && vuln.version === '3.0.1');
    });

    t.equal(vulns.length, 1, 'narrowed to test vuln');

    snyk.dotfile.save = function (string) {
      t.equal(string, 'remy', 'dotfile format is correct');
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