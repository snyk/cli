import { test } from 'tap';
import interactive = require('./wizard-instrumented');
import answersToTasks from '../src/cli/commands/protect/tasks';
import * as snykPolicy from 'snyk-policy';
import * as proxyquire from 'proxyquire';
const patch = proxyquire('../src/lib/protect/patch', {
  './apply-patch': () => {
    return Promise.resolve(true);
  },
});

test('patch does not try to apply the same patch more than once', async (t) => {
  const responses = ['default:patch', 'default:patch', 'n', 'n'];

  const vulns = require(__dirname + '/fixtures/scenarios/SC-965.json');

  const answers = await interactive(vulns, responses);
  const tasks = answersToTasks(answers);
  const res = await patch(tasks.patch, false);
  const demunged = snykPolicy.demunge(res);
  const count = demunged.patch.reduce((acc, curr) => {
    acc += curr.paths.length;
    return acc;
  }, 0);
  t.equal(count, 6, 'all patches in place');
});
