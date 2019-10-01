var test = require('tap').test;
var interactive = require('./wizard-instrumented');
var answersToTasks = require('../src/cli/commands/protect/tasks');
var snykPolicy = require('snyk-policy');
var proxyquire = require('proxyquire');
var patch = proxyquire('../src/lib/protect/patch', {
  './apply-patch': function() {
    return Promise.resolve(true);
  },
});

test('patch does not try to apply the same patch more than once (SC-965)', function(t) {
  var responses = ['default:patch', 'default:patch', 'n', 'n'];

  var vulns = require(__dirname + '/fixtures/scenarios/SC-965.json');

  return interactive(vulns, responses).then(function(answers) {
    var tasks = answersToTasks(answers);
    return patch(tasks.patch, false).then(function(v) {
      var demunged = snykPolicy.demunge(v);
      var count = demunged.patch.reduce(function(acc, curr) {
        acc += curr.paths.length;
        return acc;
      }, 0);
      t.equal(count, 6, 'all patches in place');
    });
  });
});
