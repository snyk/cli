const protect = require('../../src/lib/protect');
import { test } from 'tap';
import { loadJson } from '../utils';
import { getFixturePath } from '../jest/util/getFixturePath';
const plan = loadJson(getFixturePath('protect-interactive.json'));
const expected = loadJson(getFixturePath('protect-interactive-config.json'));

test('protect generates config', async (t) => {
  let config: {
    ignore?: any;
  } = {};
  try {
    config = await protect.generatePolicy(config, plan, false);
    // copy the expires from the config to our expected object
    Object.keys(config.ignore).forEach((id) => {
      // each vuln id
      config.ignore[id].forEach((path, i) => {
        if (typeof path !== 'string') {
          path = Object.keys(path).pop();
          expected.ignore[id][i][path].expires =
            config.ignore[id][i][path].expires;
        }
      });
    });
    t.deepEqual(expected, config, 'config is as expected');
  } catch (e) {
    t.fail('Should have passed', e.message);
  }
});
