var test = require('tap-only');
var fs = require('fs');

var policy = require('snyk-policy');

test('policy match logic', function (t) {
  var rule = {
    'express-hbs > handlebars > uglify-js': {
      reason: 'None given',
      expires: '2016-03-01T19:49:50.633Z'
    },
    'handlebars > uglify-js': {
      reason: 'done this already',
      expires: '2016-03-01T19:53:46.310Z'
    }
  };

  var vulns = JSON.parse(fs.readFileSync(__dirname + '/fixtures/jsbin-policy/jsbin.json', 'utf8')).vulnerabilities;

  var vuln = vulns.filter(function (v) {
    return v.id === 'npm:uglify-js:20150824';
  }).pop();

  var pathMatch = policy.matchToRule(vuln, rule);
  t.ok(pathMatch, 'vuln matches rule');
  t.end();
});

test('policy match (triggering not found)', function (t) {
  var vuln = require(__dirname + '/fixtures/path-not-found.json');
  var rule = {
    'glue > hapi > joi > moment': {
      'patched': '2016-02-26T16:19:06.050Z'
    }
  };

  var pathMatch = policy.matchToRule(vuln, rule);
  t.equal(pathMatch, false, 'path does not match');
  t.end();
});
