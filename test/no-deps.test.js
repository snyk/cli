'use strict';
var test = require('tape');
var path = require('path');
var snyk = require('../src/lib');

var osDir = path.resolve(__dirname, 'fixtures', 'no-deps');

test('works when there are no dependencies', function(t) {
  t.plan(2);
  snyk
    .modules(osDir)
    .then(function(modules) {
      t.ok(true, 'modules did not bail');
      t.deepEqual(modules.dependencies, {});
    })
    .catch(function(e) {
      t.fail(e.message);
      console.log(e.stack);
      t.bailout();
    });
});
