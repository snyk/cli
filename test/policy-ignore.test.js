var test = require('tap').test;
var Promise = require('es6-promise').Promise; // jshint ignore:line

var policy = require('../lib/policy');
var protect = require('../lib/protect');

test('ignored vulns do not turn up in tests', function (t) {
  var dir = __dirname + '/fixtures/jsbin-policy/';
  var res = require(dir + 'jsbin.json');
  policy.load(dir).then(function (config) {
    t.equal(res.vulnerabilities.length, 8, 'initial vulns correct');

    res.vulnerabilities = protect.filterIgnored(
      config.ignore,
      res.vulnerabilities,
      dir
    );

    // should strip:
    // - npm:handlebars:20151207
    // - npm:uglify-js:20150824

    t.equal(res.vulnerabilities.length, 6, 'post filter');
  }).catch(t.threw).then(t.end);
});