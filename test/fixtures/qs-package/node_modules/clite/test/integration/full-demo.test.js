'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require(fixtures + '/basic-clite/cli');

test('throws when no package available', function (t) {
  process.argv = sampleArgs.concat('pass', '-d', '-g=words');
  return clite({
    commands: {
      _: 'index',
      echo: 'echo',
      pass: 'passthrough'
    },
    booleans: ['debug', 'dev'],
    alias: {
      d: 'debug'
    },
    options: ['grep']
  }).then(function (res) {
    t.deepEqual(res.args._, [], 'no supplementary args');
    t.equal(res.args.grep, 'words', 'options found');
    t.equal(res.args.debug, true, 'debug found');
    t.equal(res.args.dev, false, 'dev set found');
  });
});

test('all args parsed', function (t) {
  process.argv = sampleArgs.concat('.', '-d');
  return clite({
    commands: {
      _: 'passthrough'
    },
    options: ['filter', 'count'],
    alias: { d: 'dev' },
    booleans: ['disk', 'json', 'errors', 'dev', 'production', 'optional',
      'bundled', 'extraneous'],
    help: 'usage.txt'
  }).then(function (res) {
    t.isa(res.args.filter, 'undefined', 'filter is not there');
    t.equal(res.args.dev, true, 'dev set');
  });
});