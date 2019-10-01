var test = require('tap').test;
var policy = require('snyk-policy');
var extendExpiries = require('./utils').extendExpiries;

test('ignored vulns do not turn up in tests', function(t) {
  var dir = __dirname + '/fixtures/jsbin-policy/';
  var res = require(dir + 'jsbin.json');
  policy
    .load(dir)
    .then(function(config) {
      var start = res.vulnerabilities.length;
      t.equal(start, 8, 'initial vulns correct');

      extendExpiries(config);

      res = config.filter(res, dir);

      // should strip:
      // - npm:handlebars:20151207
      // - npm:uglify-js:20150824
      t.equal(res.vulnerabilities.length, start - 2, 'post filter');
    })
    .catch(t.threw)
    .then(t.end);
});
