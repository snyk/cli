import { test } from 'tap';
import * as path from 'path';
import * as snyk from '../src/lib';

const osDir = path.resolve(__dirname, 'fixtures', 'demo-private');

test('finds all sub-dependencies', async (t) => {
  try {
    const modules = await snyk.modules(osDir);
    t.ok(true, 'did not bail');
    t.ok(JSON.stringify(modules), 'modules successfully stringified');
    t.deepEqual(
      modules.dependencies.marked.dependencies,
      {},
      'marked has no dependencies',
    );
  } catch (e) {
    t.fail('Should have passed: ' + e);
  }
});
