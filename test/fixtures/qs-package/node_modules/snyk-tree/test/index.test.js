var test = require('tap').test;
var lib = require('../');
var fixture = require(__dirname + '/fixture.json');
var expect = require('fs').readFileSync(__dirname + '/fixture.txt', 'utf8').trim();
var expect2 = require('fs').readFileSync(__dirname + '/fixture-custom.txt', 'utf8').trim();

test('npm-tree', function (t) {
  t.equal(lib(fixture).trim(), expect, 'matches');
  t.end();
});

test('npm-tree custom render', function (t) {
  var r = function (leaf) {
    return leaf.name;
  };

  t.equal(lib(fixture, r).trim(), expect2, 'matches');
  t.end();
});