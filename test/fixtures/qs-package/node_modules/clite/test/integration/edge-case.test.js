'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require('../../');

test('allows for command command (not called)', function (t) {
  process.argv = sampleArgs.concat('pass');
  return clite({ return: true, commands: {
    command: '.',
    pass: 'passthrough',
  } }, fixtures + '/basic-clite').then(function (res) {
    t.notEqual(res, 'hello world', 'did not default to index');
  });
});

test('allows for command command (called)', function (t) {
  process.argv = sampleArgs.concat('command');
  return clite({ return: true, commands: {
    command: '.',
    pass: 'passthrough',
  } }, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, 'hello world', 'command correct');
  });
});

test('allows for command argument to be passed', function (t) {
  process.argv = sampleArgs.concat('pass', '--command=ok');
  return clite({ return: true, commands: {
    pass: 'passthrough',
  } }, fixtures + '/basic-clite').then(function (res) {
    t.equal(res.args.command, 'ok', 'command argument correct');
  });
});

