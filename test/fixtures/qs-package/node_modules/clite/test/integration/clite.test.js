'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require('../../');

test('throws when no package available', function (t) {
  return clite({}, fixtures + '/no-package').catch(function (e) {
    t.match(e.message, /no such file or directory/, 'throws when no package found');
  });
});

test('throws when unknown command', function (t) {
  process.argv = sampleArgs.concat('foo');
  return clite({}, fixtures + '/basic-clite').then(function (res) {
    t.fail('did not want: ' + res);
  }).catch(function (e) {
    t.equal(e.code, 'MODULE_NOT_FOUND', 'throws when unknown command');
  });
});

test('throws when no command', function (t) {
  process.argv = sampleArgs;
  return clite({}, fixtures + '/basic-clite').then(function (res) {
    t.fail('did not want: ' + res);
  }).catch(function (e) {
    t.equal(e.code, 'BAD_ARGS', 'throws when no command');
  });
});

test('shows help when no args, default command and no stdin', function (t) {
  process.argv = sampleArgs.slice(0);
  return clite({ return: true }, fixtures + '/basic-clite').then(function (res) {
    t.fail('should not succeed: ' + res);
  }).catch(function (e) {
    t.ok(true);
  });
});

test('loads index.js from project root', function (t) {
  return clite({ commands: { _: '.' } }, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, 'hello world', 'index.js ran');
  });
});

test('runs internal version logic', function (t) {
  process.argv = sampleArgs.concat('-v');
  return clite({}, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, '1.2.3', 'loaded correct package and returns version');
  });
});