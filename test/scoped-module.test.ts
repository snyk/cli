import { test } from 'tap';
import * as path from 'path';
import snyk = require('../src/lib');

const dir = path.resolve(__dirname, 'fixtures', 'qs-package');

test('module traversal can find scoped packages', async (t) => {
  try {
    await snyk.modules(dir).then((res) => {
      const deps = Object.keys(res.dependencies).sort();
      const expect = ['qs', '@remy/protect-test'].sort();
      t.deepEqual(deps, expect, 'scoped local packages found');
    });
  } catch (e) {
    t.fail('Should have passed:' + e);
  }
});
