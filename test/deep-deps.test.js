'use strict';
var test = require('tape');
// var util = require('util');
var path = require('path');
var snyk = require('..');

var osDir = path.resolve(__dirname, 'fixtures', 'demo-private');

test('finds all sub-dependencies', function (t) {
  t.plan(2);
  snyk.modules(osDir).then(function (modules) {
    t.ok(true, 'did not bail');
    t.equal(modules.dependencies.marked.dependencies, false, 'marked has no dependencies');
  }).catch(function (e) {
    t.fail(e.message);
    console.log(e.stack);
    t.bailout();
  });
});