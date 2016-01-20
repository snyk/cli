var policy = require('../lib/policy');
var snyk = require('../lib');
var test = require('tape');
var dir1 = __dirname + '/fixtures/qs-package';
var dir2 = __dirname + '/fixtures/qs-package/node_modules/@remy/protect-test';

var dir3 = __dirname + '/fixtures/uglify-package';
var dir4 = __dirname + '/fixtures/uglify-package/node_modules/ug-deep';


test('policies merge', function (t) {
  t.plan(2);
  policy.load([dir1, dir2]).then(function (res) {
    t.pass(res.patch, 'patch property is present');
    t.equal(Object.keys(res.patch).length, 1, '1 patch available via deep dep');
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
    t.end();
  });
});

test('policies do not merge ignore rules', function (t) {
  t.plan(2);
  policy.load([dir3, dir4]).then(function (res) {
    t.equal(Object.keys(res.ignore).length, 0, 'ignores are still zero');
    t.equal(Object.keys(res.suggest).length, 1, 'suggestion to ignore 1');
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e);
    t.end();
  });
});

test('policies merge when detected from tests', function (t) {
  t.plan(1);
  snyk.test(dir1).then(function (res) {
    var vulns = res.vulnerabilities.map(function (v) {
      return v.id;
    });
    t.equal(vulns.indexOf('npm:semver:20150403'), -1, 'semver is ignored via deep policy');
  });
});