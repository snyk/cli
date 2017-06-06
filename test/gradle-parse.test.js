var test = require('tap').test;
var parse = require('../lib/plugins/gradle/gradle-deps-parse');
var fs = require('fs');

test('compare full results', function (t) {
  t.plan(1);
  var gradleOutput = fs.readFileSync(
    __dirname + '/fixtures/gradle/gradle-dependencies-output.txt', 'utf8');
  var depTree = parse(gradleOutput, 'myPackage@1.0.0');
  var results = require(
    __dirname + '/fixtures/gradle/gradle-dependencies-results.json');

  t.same(depTree, results);
});

test('parse a `gradle dependencies` output', function(t) {
  t.plan(7);
  var gradleOutput = fs.readFileSync(
    __dirname + '/fixtures/gradle/gradle-dependencies-output.txt', 'utf8');
  var depTree = parse(gradleOutput, 'myPackage@1.0.0');

  t.equal(
    depTree['axis:axis']
      .dependencies['commons-discovery:commons-discovery'].version,
    '0.2', 'resolved correct version for discovery');

  t.equal(depTree['com.android.tools.build:builder'].groupId,
    'com.android.tools.build', 'found dependency');

  if (typeof depTree['failed:failed'] === 'undefined') {
    t.pass('failed dependency ignored');
  } else {
    t.fail('failed dependency is included in result');
  }

  t.equal(
    depTree['com.android.tools.build:builder']
      .dependencies['com.android.tools:sdklib']
      .dependencies['com.android.tools:repository']
      .dependencies['com.android.tools:common']
      .dependencies['com.android.tools:annotations'].version,
    '25.3.0', 'resolved ommitted dependency version (1)');

  t.equal(
    depTree['com.android.tools.build:builder']
      .dependencies['com.android.tools:sdklib']
      .dependencies['com.android.tools:repository']
      .dependencies['com.android.tools:common']
      .dependencies['com.android.tools:annotations'].from[0],
    'myPackage@1.0.0', 'resolved ommitted dependency path (1)');

  t.equal(
    depTree['com.android.tools.build:builder']
      .dependencies['com.android.tools.build:manifest-merger']
      .dependencies['com.android.tools:sdklib']
      .dependencies['com.android.tools:dvlib']
      .dependencies['com.android.tools:common']
      .dependencies['com.google.guava:guava'].version,
    '18.0', 'resolved ommitted dependency version (2)');

  t.equal(
    depTree['com.android.tools.build:builder']
      .dependencies['com.android.tools.build:manifest-merger']
      .dependencies['com.android.tools:sdklib']
      .dependencies['com.android.tools:dvlib']
      .dependencies['com.android.tools:common']
      .dependencies['com.google.guava:guava'].from[0],
    'myPackage@1.0.0', 'resolved ommitted dependency path (2)');
});
