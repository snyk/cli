const applyPatch = require('../../src/lib/protect/apply-patch');
const path = require('path');
const fs = require('fs');
const test = require('tap').test;
const snyk = require('../../src/lib');
const { getFixturePath } = require('../jest/util/getFixturePath');

test('bad patch file does not apply', function(t) {
  // check the target file first
  const root = getFixturePath('semver-patch-fail');
  const dir = path.resolve(root, './node_modules/semver');
  const semver = fs.readFileSync(dir + '/semver.js', 'utf8');
  t.ok('original semver loaded');

  const old = snyk.config.get('disable-analytics');
  snyk.config.set('disable-analytics', '1');

  applyPatch(
    root + '/363ce409-2d19-46da-878a-e059df2d39bb.snyk-patch',
    {
      source: dir,
      name: 'semver',
      version: '4.3.1',
      id: 'npm:semver:20150403',
      from: ['semver@4.3.1'],
    },
    true,
    'http://some.patch.url',
  )
    .then(function() {
      t.fail('patch successfully applied');
      fs.writeFileSync(dir + '/semver.js', semver);
    })
    .catch(function(error) {
      const semver2 = fs.readFileSync(dir + '/semver.js', 'utf8');
      t.equal(semver, semver2, 'target was untouched');
      t.equal(error.code, 'FAIL_PATCH', 'patch failed, task exited correctly');
    })
    .then(function() {
      // clean up
      /* TODO:
      These promises might throw, but you still want to run all of them
      Might need rethinking of this test
      */
      return Promise.all([
        new Promise((r) => fs.unlink(dir + '/semver.js.orig', r)),
        new Promise((r) => fs.unlink(dir + '/semver.js.rej', r)),
        new Promise((r) => fs.unlink(dir + '/test/big-numbers.js.orig', r)),
        new Promise((r) => fs.unlink(dir + '/test/big-numbers.js.rej', r)),
        new Promise((r) => fs.writeFile(dir + '/semver.js', semver, r)),
      ]);
    })
    .then(function() {
      t.ok('clean up done');
    })
    .catch(function(e) {
      console.log(e);
      t.fail('clean up failed');
    })
    .then(function() {
      if (old === undefined) {
        snyk.config.delete('disable-analytics');
      } else {
        snyk.config.set('disable-analytics', old);
      }
      t.end();
    });
});
