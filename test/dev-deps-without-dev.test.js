'use strict';
var test = require('tape');
var path = require('path');
var snyk = require('..');

// FIXME this test doesn't actually work yet, since
var osDir = path.resolve(__dirname, 'fixtures', 'dev-deps-demo');

var oldValue = null;
test('setup', function (t) {
  var config = require('../lib/config');
  oldValue = config.devDeps;
  config.devDeps = false;
  t.pass('config primed');
  t.end();
});

test('dev deps: dev-deps-demo, including dev deps', function (t) {
  function runTests(t, error, modules) {
    t.plan(3 + 1 + (3 * 2));
    //t.comment(JSON.stringify(modules));
    var expectedDirectDeps = {
      'qs': '0.6.6',
      'semver': '3.0.1',
      'kind-of': '2.0.1',
      'dev-deps-demo': null,
    };

    if (error) {
      t.fail(error.message);
      t.bailout();
    }
    t.ok(!error, 'module reading did not error');
    t.ok(typeof modules === 'object', 'modules is an object');

    var keys = Object.keys(modules.dependencies);
    var count = keys.length;
    t.equal(count, 3, 'dep count');

    keys.forEach(function (key) {
      t.ok(expectedDirectDeps[key] !== undefined, key + ' was expected');

      // For kind-of, test that its child dependencies were properly included
      if (key === 'kind-of') {
        var childDeps = modules.dependencies[key].dependencies;
        var childKeys = Object.keys(childDeps);
        t.equal(childKeys.length, 1, 'dep count of kind-of');

        // Check child dependencies
        t.ok(childDeps['is-buffer'] !== undefined, 'is-buffer child dep was expected');
      } else {
        t.equal(expectedDirectDeps[key], modules.dependencies[key].version, key + ' version is correct');
      }
    });
    t.end();
  }
  t.test('specified directory', function (t) {
    snyk.modules(osDir, function (error, modules) {
      if (error) console.log(error.stack);
      runTests(t, error, modules);
    });
  });

  t.test('inferred directory', function (t) {
    process.chdir(osDir);

    snyk.modules(function (error, modules) {
      runTests(t, error, modules);
    });
  });
});


var oldValue = null;
test('teardown', function (t) {
  var config = require('../lib/config');
  config.devDeps = oldValue;
  t.pass('config restored');
  t.end();
});
