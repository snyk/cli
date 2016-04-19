var patch = require('../lib/protect/patch');
var test = require('tap-only');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var policy = require('snyk-policy');
var dir = __dirname + '/fixtures/bugs/SC-1076';
var vulns = require(dir + '/vulns.json');

test('protect patches in the correct order - SC-1076', t => {
  return policy.load(dir).then(policy => {
    if (policy.patch) {
      return patch(vulns, { 'dry-run': true });
    }
    return 'Nothing to do';
  });
});
