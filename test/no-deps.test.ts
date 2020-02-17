import { test } from 'tap';
import * as path from 'path';
import * as snyk from '../src/lib';

const osDir = path.resolve(__dirname, 'fixtures', 'no-deps');

test('works when there are no dependencies', async (t) => {
  try {
    const modules = await snyk.modules(osDir);
    t.ok(true, 'modules did not bail');
    t.deepEqual(modules.dependencies, {});
  } catch (e) {
    t.fail('Should have passed:' + e);
  }
});
