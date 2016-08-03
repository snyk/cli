'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require('../../');

test('gets version from package.json', function (t) {
  process.argv = sampleArgs.concat('--version');
  return clite({}, fixtures + '/basic-clite').then(function (res) {
    t.equals(res, '1.2.3', 'got version');
  });
});

test('gets version from github when missing from package', function (t) {
  process.argv = sampleArgs.concat('--version');
  return clite({}, fixtures + '/dev-package').then(function (res) {
    t.match(res, /^(.*): [a-z0-9]{7}/, 'got branch and commit');
  });
});