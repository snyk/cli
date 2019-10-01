'use strict';
var test = require('tape');
var path = require('path');
var snyk = require('../src/lib');

var cwd = process.cwd();
var osDir = path.resolve(__dirname, 'fixtures', 'demo-private');

test('module reporting: private project', function(t) {
  function runTests(t, error, modules) {
    t.plan(3 + 4 * 3); // 3 coded tests + 5 module specific tests

    var expectedModules = {
      express: '3.21.1',
      autocache: '0.6.1',
      less: '2.5.1',
      marked: '0.2.10',
      'demo-private': null,
    };

    if (error) {
      t.fail(error.message);
      t.bailout();
    }
    t.ok(!error, 'module reading did not error');
    t.ok(typeof modules === 'object', 'modules is an object');

    var keys = Object.keys(modules.dependencies);
    var count = keys.length;
    t.equal(count, 4, 'dep count');

    keys.forEach(function(key) {
      t.ok(expectedModules[key] !== undefined, key + ' was expected');

      // specical case for demo-private - as it doesn't have a version
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
          key + ' version was satisified WRT dep',
        );
      }
    });
    t.end();
  }

  t.test('specified directory', function(t) {
    snyk.modules(osDir).then(function(modules) {
      runTests(t, null, modules);
    });
  });

  t.test('inferred directory', function(t) {
    process.chdir(osDir);

    snyk.modules('.').then(function(modules) {
      runTests(t, null, modules);
    });
  });
});

test('teardown', function(t) {
  process.chdir(cwd);
  t.pass('reset cwd');
  t.end();
});
