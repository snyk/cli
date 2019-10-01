'use strict';
var test = require('tape');
// var util = require('util');
var path = require('path');
var snyk = require('../src/lib');

var osDir = path.resolve(__dirname, 'fixtures', 'demo-private');

test('finds all sub-dependencies', function(t) {
  t.plan(3);
  snyk
    .modules(osDir)
    .then(function(modules) {
      t.ok(true, 'did not bail');
      t.ok(JSON.stringify(modules), 'modules successfully stringified');
      t.deepEqual(
        modules.dependencies.marked.dependencies,
        {},
        'marked has no dependencies',
      );
    })
    .catch(function(e) {
      t.fail(e.message);
      console.log(e.stack);
      t.bailout();
    });
});
