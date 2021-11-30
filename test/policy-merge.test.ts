import policy from 'snyk-policy';
import { test } from 'tap';
import * as snyk from '../src/lib';
const dir1 = __dirname + '/fixtures/qs-package';
const dir2 = __dirname + '/fixtures/qs-package/node_modules/@remy/protect-test';
const dir3 = __dirname + '/fixtures/uglify-package';
const dir4 = __dirname + '/fixtures/uglify-package/node_modules/ug-deep';
const dir5 = __dirname + '/fixtures/no-deps';

test('policies merge', async (t) => {
  try {
    const res = await policy.load([dir1, dir2]);
    t.ok(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  } catch (e) {
    t.threw();
  }
});

test('policies merge even if dir has no policy', async (t) => {
  try {
    const res = await policy.load([dir5, dir2], { loose: true });
    t.ok(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  } catch (e) {
    t.threw();
  }
});

test('policies do not merge ignore rules', async (t) => {
  try {
    const res = await policy.load([dir3, dir4]);
    t.equal(Object.keys(res.ignore).length, 0, 'ignores are still zero');
    t.equal(Object.keys(res.suggest).length, 1, 'suggestion to ignore 1');
  } catch (e) {
    t.threw();
  }
});

test('policies merge when detected from tests', async (t) => {
  try {
    const res = await snyk.test(dir1);
    const vulns = (res as any).vulnerabilities.map((v) => {
      return v.id;
    });
    t.equal(
      vulns.indexOf('npm:semver:20150403'),
      -1,
      'semver is ignored via deep policy',
    );
  } catch (err) {
    t.threw(err);
  }
});
