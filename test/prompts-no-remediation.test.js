var test = require('tape');
var getPrompts = require('../cli/commands/protect/prompts').getPrompts;
var vulns = require('./fixtures/test-jsbin-vulns-updated.json').vulnerabilities;

test('ensure that when there is not remediation, prompt text is correct',
  function (t) {
  var promptOptions = getPrompts(vulns);
  // firstly filter down to just the ignore prompts
  var res = promptOptions
    .filter(_ => !_.when)
    .map(_ => _.choices)
    .map(_ => _.filter(_ => _.key === 'i').pop());

  // now pick out those that say they'll notify and check the vuln really
  // doesn't have a remediation path
  // res = res.filter(_ => _.name.indexOf('notify') !== -1);

  t.plan(res.length);

  res.forEach(_ => {
    if (_.name.indexOf('notify') !== -1) {
      t.notEqual(_.value.vuln.upgradePath.filter(Boolean).length,
        _.value.vuln.from.length -1,
        'Upgrade path is shorter than dep depth ∴ no remediation');
    } else {
      t.equal(_.value.vuln.upgradePath.filter(Boolean).length,
        _.value.vuln.from.length -1,
        'Upgrade path has remediation');
    }
  });

  t.end();
});