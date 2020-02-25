import { test } from 'tap';
import * as path from 'path';

import * as snyk from '../src/lib';
import * as config from '../src/lib/config';

const dir = path.resolve(__dirname, 'fixtures', 'dev-deps-demo');

let oldValue = null;

test('setup', async (t) => {
  oldValue = (config as any).devDeps;
  (config as any).devDeps = true;
  t.pass('config primed');
});

test('dev deps: dev-deps-demo, including dev deps', async (t) => {
  const expectedDirectDeps = {
    qs: '0.6.6',
    semver: '3.0.1',
    'kind-of': '2.0.1',
    'uglify-js': '2.3.6',
    'dev-deps-demo': null,
  };

  try {
    const modules = await snyk.modules(dir, { dev: true });
    const keys = Object.keys(modules.dependencies);
    t.equal(keys.length, 4, 'dep count');

    keys.forEach((key) => {
      t.ok(expectedDirectDeps[key] !== undefined, key + ' was expected');

      // For kind-of, test that its child dependencies were properly included
      if (key === 'kind-of') {
        const childDeps = modules.dependencies[key].dependencies;
        const childKeys = Object.keys(childDeps);
        t.equal(childKeys.length, 2, 'dep count of kind-of');

        // Check child dependencies
        t.ok(
          childDeps['is-buffer'] !== undefined,
          'is-buffer child dep was expected',
        );
        t.ok(childDeps.typeof !== undefined, 'typeof child dep was expected');
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

test('teardown', async (t) => {
  (config as any).devDeps = oldValue;
  t.pass('config restored');
});
