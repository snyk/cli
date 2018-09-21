var test = require('tap').test;
var policy = require('snyk-policy');
var snyk = require('../src/lib');
var dir1 = __dirname + '/fixtures/qs-package';
var dir2 = __dirname + '/fixtures/qs-package/node_modules/@remy/protect-test';
var dir3 = __dirname + '/fixtures/uglify-package';
var dir4 = __dirname + '/fixtures/uglify-package/node_modules/ug-deep';
var dir5 = __dirname + '/fixtures/no-deps';

test('policies merge', function (t) {
  policy.load([dir1, dir2]).then(function (res) {
    t.ok(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  }).catch(t.threw).then(t.end);
});

test('policies merge even if dir has no policy', function (t) {
  policy.load([dir5, dir2], { loose: true }).then(function (res) {
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
    var vulns = res.vulnerabilities.map(function (v) {
      return v.id;
    });
    t.equal(vulns.indexOf('npm:semver:20150403'), -1, 'semver is ignored via deep policy');
  }).catch(function (err) {
    t.threw(err);
  })
});
