const test = require('tap').test;
const policy = require('snyk-policy');
const snyk = require('../src/lib');
const dir1 = __dirname + '/fixtures/qs-package';
const dir2 = __dirname + '/fixtures/qs-package/node_modules/@remy/protect-test';
const dir3 = __dirname + '/fixtures/uglify-package';
const dir4 = __dirname + '/fixtures/uglify-package/node_modules/ug-deep';
const dir5 = __dirname + '/fixtures/no-deps';

test('policies merge', function (t) {
  policy.load([dir1, dir2]).then(function (res) {
    t.ok(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  }).catch(t.threw).then(t.end);
});

test('policies merge even if dir has no policy', function (t) {
  policy.load([dir5, dir2], {loose: true}).then(function (res) {
    t.ok(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  }).catch(t.threw).then(t.end);
});

test('policies do not merge ignore rules', function (t) {
  policy.load([dir3, dir4]).then(function (res) {
    t.equal(Object.keys(res.ignore).length, 0, 'ignores are still zero');
    t.equal(Object.keys(res.suggest).length, 1, 'suggestion to ignore 1');
  }).catch(t.threw).then(t.end);
});

test('policies merge when detected from tests', function (t) {
  t.plan(1);
  snyk.test(dir1).then(function (res) {
    const vulns = res.vulnerabilities.map(function (v) {
      return v.id;
    });
    t.equal(vulns.indexOf('npm:semver:20150403'), -1, 'semver is ignored via deep policy');
  }).catch(function (err) {
    t.threw(err);
  });
});
