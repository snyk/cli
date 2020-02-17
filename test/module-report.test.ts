import { test } from 'tap';
import * as path from 'path';
import * as snyk from '../src/lib';

const cwd = process.cwd();
const osDir = path.resolve(__dirname, 'fixtures', 'demo-private');

async function runTests(t, error, modules) {
  const expectedModules = {
    express: '3.21.1',
    autocache: '0.6.1',
    less: '2.5.1',
    marked: '0.2.10',
    'demo-private': null,
  };

  if (error) {
    t.fail(error.message);
  }
  t.ok(!error, 'module reading did not error');
  t.ok(typeof modules === 'object', 'modules is an object');

  const keys = Object.keys(modules.dependencies);
  const count = keys.length;
  t.equal(count, 4, 'dep count');

  keys.forEach((key) => {
    t.ok(expectedModules[key] !== undefined, key + ' was expected');

    // special case for demo-private - as it doesn't have a version
    if (key === 'demo-private') {
      t.equal(modules[key].version, null, 'no version on demo-private');
      t.equal(modules[key].valid, undefined, 'no dep test on demo-private');
    } else {
      t.equal(
        expectedModules[key],
        modules.dependencies[key].version,
        key + ' version is correct',
      );
      t.equal(
        modules.dependencies[key].valid,
        true,
        key + ' version was satisfied WRT dep',
      );
    }
  });
}

test('module reporting: private project', async (t) => {
  t.test('specified directory', async (t) => {
    const modules = await snyk.modules(osDir);
    await runTests(t, null, modules);
  });

  t.test('inferred directory', async (t) => {
    process.chdir(osDir);

    const modules = await snyk.modules('.');
    await runTests(t, null, modules);
  });
});

test('teardown', async (t) => {
  process.chdir(cwd);
  t.pass('reset cwd');
});
