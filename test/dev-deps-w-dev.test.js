'use strict';
var test = require('tap').test;
var path = require('path');
var snyk = require('..');

var dir = path.resolve(__dirname, 'fixtures', 'dev-deps-demo');

var oldValue = null;
test('setup', function (t) {
  var config = require('../src/lib/config');
  oldValue = config.devDeps;
  config.devDeps = true;
  t.pass('config primed');
  t.end();
});

test('dev deps: dev-deps-demo, including dev deps', function (t) {
  function runTests(t, error, modules) {
    var expectedDirectDeps = {
      'uglify-js': '2.3.6',
      qs: '0.6.6',
      semver: '3.0.1',
      'kind-of': '2.0.1',
      'dev-deps-demo': null,
    };

    if (error) {
      t.fail(error.message);
      t.bailout();
    }

    var keys = Object.keys(modules.dependencies);
    var count = keys.length;
    t.equal(count, 4, 'dep count');

    keys.forEach(function (key) {
      t.ok(expectedDirectDeps[key] !== undefined, key + ' was expected');

      // For kind-of, test that its child dependencies were properly included
      if (key === 'kind-of') {
        var childDeps = modules.dependencies[key].dependencies;
        var childKeys = Object.keys(childDeps);
        t.equal(childKeys.length, 2, 'dep count of kind-of');

        // Check child dependencies
        t.ok(childDeps['is-buffer'] !== undefined,
          'is-buffer child dep was expected');
        t.ok(childDeps['typeof'] !== undefined,
          'typeof child dep was expected');
      } else {
        t.equal(expectedDirectDeps[key], modules.dependencies[key].version,
          key + ' version is correct');
      }
    });
    t.end();
  }

  snyk.modules(dir, { dev: true }).then(function (modules) {
    var error = null;
    if (error) {
      console.log(error.stack);
    }
    runTests(t, error, modules);
  });
});


var oldValue = null;
test('teardown', function (t) {
  var config = require('../src/lib/config');
  config.devDeps = oldValue;
  t.pass('config restored');
  t.end();
});
