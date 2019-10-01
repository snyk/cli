var policy = require('snyk-policy');
var getPrompts = require('../src/cli/commands/protect/prompts').getPrompts;
var test = require('tape');

test('policy file populates ignore reasons', function(t) {
  var vulns = require('./fixtures/colonizers-vulns.json').vulnerabilities;
  var id = 'npm:tar:20151103';

  policy
    .load(__dirname + '/fixtures/colonizers')
    .then(function(config) {
      var allPrompts = getPrompts(vulns, config);

      // firstly collect the prompt that matches our vuln id that is the
      // ignore reason - grab the first one
      var prompt = allPrompts
        .filter(function(p) {
          return p.name.indexOf('-reason') !== -1;
        })
        .filter(function(p) {
          return p.name.indexOf(id) === 0;
        })
        .shift();

      // using the `prompt` (above) filter down and find the full vuln. this is
      // done by the `.name` being the same, except the reason has a `-reason`
      // suffix.
      var vuln = allPrompts
        .filter(function(p) {
          return p.name === prompt.name.replace(/-reason$/, '');
        })
        .shift().choices[0].value.vuln;

      // now we find the policy rule based on the vulnerability we found, which
      // uses the `.from` to full indentify it (either using glob paths, semver
      // or an exact match).
      var rule = policy.getByVuln(config, vuln);

      t.notEqual(rule.reason, undefined, 'reason should not be undefined');
      t.equal(
        prompt.default,
        rule.reason,
        'reasons should match in default value',
      );
      t.end();
    })
    .catch(function(e) {
      console.log(e.stack);
      t.fail('could not load the policy file');
      t.end();
    });
});
