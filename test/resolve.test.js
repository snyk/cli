'use strict';
var test = require('tape');
var resolve = require('../lib/resolve');

test('resolve package objects', function (t) {
  var src = {
    name: 'foo',
    version: 2,
  };
  resolve(src).then(function (pkg) {
    t.deepEqual(pkg, src, 'package is an object and matches');
    t.end();
  });
});

test('throws on invalid objects', function (t) {
  var src = {
    version: 2,
  };
  resolve(src).then(function () {
    t.fail('resolve should not have completed');
    t.end();
  }).catch(function (error) {
    t.ok(error instanceof Error, 'correctly errored');
    t.end();
  });
});

test('handles strings as modules', function (t) {
  var src = 'foo';
  resolve(src).then(function (res) {
    t.equal(src, res, 'module name matches');
    t.end();
  });
});

test('converts strings with versions to url path', function (t) {
  var src = 'foo@1.2.2';
  resolve(src).then(function (res) {
    t.equal(src.replace('@', '/'), res, 'module name matches');
    t.end();
  });
});

test('reads packages from directories', function (t) {
  var expected = require('./fixtures/no-deps/package.json');
  resolve(__dirname + '/fixtures/no-deps').then(function (res) {
    t.deepEqual(expected, res, 'package read from directory');
    t.end();
  });
});

test('reads packages from file', function (t) {
  var expected = require('./fixtures/no-deps/package.json');
  resolve(__dirname + '/fixtures/no-deps/package.json').then(function (res) {
    t.deepEqual(expected, res, 'package read from file');
    t.end();
  });
});