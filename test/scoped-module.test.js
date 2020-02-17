var test = require('tap').test;
var path = require('path');
var snyk = require('../src/lib');

var dir = path.resolve(__dirname, 'fixtures', 'qs-package');

test('module traversal can find scoped packages', function(t) {
  t.plan(1);
  snyk
    .modules(dir)
    .then(function(res) {
      var deps = Object.keys(res.dependencies).sort();
      var expect = ['qs', '@remy/protect-test'].sort();
      t.deepEqual(deps, expect, 'scoped local packages found');
    })
    .catch(function(e) {
      console.log(e.stack);
      t.fail(e.message);
    });
});
