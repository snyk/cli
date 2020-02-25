import { test } from 'tap';
import * as path from 'path';

import * as snyk from '../src/lib';

test('dev deps: dev-deps-demo, _excluding_ dev deps', async (t) => {
  const dir = path.resolve(__dirname, 'fixtures', 'dev-deps-demo');
  const expectedDirectDeps = {
    qs: '0.6.6',
    semver: '3.0.1',
    'kind-of': '2.0.1',
    'dev-deps-demo': null,
  };

  try {
    const modules = await snyk.modules(dir);

    const keys = Object.keys(modules.dependencies);
    t.equal(keys.length, 3, 'dep count');

    keys.forEach((key) => {
      t.ok(expectedDirectDeps[key] !== undefined, key + ' was expected');

      // For kind-of, test that its child dependencies were properly included
      if (key === 'kind-of') {
        const childDeps = modules.dependencies[key].dependencies;
        t.equal(Object.keys(childDeps).length, 2, 'dep count of kind-of');

        // Check child dependencies
        t.ok(
          childDeps['is-buffer'] !== undefined,
          'is-buffer child dep was expected',
        );
      } else {
        t.equal(
          expectedDirectDeps[key],
          modules.dependencies[key].version,
          key + ' version is correct',
        );
      }
    });
  } catch (e) {
    t.threw(e);
  }
});
