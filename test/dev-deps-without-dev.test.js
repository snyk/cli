'use strict';
var test = require('tap').test;
var path = require('path');
var snyk = require('../src/lib');

var dir = path.resolve(__dirname, 'fixtures', 'dev-deps-demo');

test('dev deps: dev-deps-demo, _excluding_ dev deps', function(t) {
  function runTests(t, modules) {
    var expectedDirectDeps = {
      qs: '0.6.6',
      semver: '3.0.1',
      'kind-of': '2.0.1',
      'dev-deps-demo': null,
    };

    var keys = Object.keys(modules.dependencies);
    var count = keys.length;
    t.equal(count, 3, 'dep count');

    keys.forEach(function(key) {
      t.ok(expectedDirectDeps[key] !== undefined, key + ' was expected');

      // For kind-of, test that its child dependencies were properly included
      if (key === 'kind-of') {
        var childDeps = modules.dependencies[key].dependencies;
        var childKeys = Object.keys(childDeps);
        t.equal(childKeys.length, 2, 'dep count of kind-of');

        // Check child dependencies
        t.ok(
          childDeps['is-buffer'] !== undefined,
          'is-buffer child dep was expected',
        );
      } else {
        t.equal(
          expectedDirectDeps[key],
          modules.dependencies[key].version,
          key + ' version is correct',
        );
      }
    });
    t.end();
  }
  snyk
    .modules(dir)
    .then(function(modules) {
      runTests(t, modules);
    })
    .catch(t.threw);
});
