'use strict';
var dist = require('./es5') ? 'dist' : 'lib';
var test = require('tap-only');
var argLib = require('../../' + dist + '/args');
var sampleArgs = ['node', 'script.js'];

function args(argv, options) {
  return argLib(argv, options).args;
}

test('load', function (t) {
  t.isa(args, 'function', 'args is a function');
  t.throws(args, 'process.argv type expected');
  t.ok(args([]), 'works with argv only arg');
  var settings = {};
  var res = args([], settings);
  t.ok(res, 'works with empty settings');
  t.deepEqual(settings, {}, 'settings did not change');
  t.end();
});

test('implicit bools', function (t) {
  var res = args(sampleArgs.concat('--foo'));
  t.equal(res.foo, true, 'foo is true');
  t.end();
});

test('bools', function (t) {
  var res = args(sampleArgs.concat('--foo'), {
    booleans: ['foo', 'bar']
  });
  t.equal(res.foo, true, 'foo is true');
  t.equal(res.bar, false, 'bar is true');
  t.deepEqual(res._, [], 'no additions args left over');
  t.end();
});

test('bools don\'t lose internal defaults', function (t) {
  var res = args(sampleArgs.concat('-v'), {
    booleans: ['foo', 'bar']
  });
  t.equal(res.foo, false, 'foo is true');
  t.equal(res.version, true, 'version is true');
  t.end();
});

test('mixed args', function (t) {
  var res = args(sampleArgs.concat('--foo', '--bar=20'), {
    booleans: ['foo', 'foosball'] // expect true/false
  });
  t.equal(res.foo, true, 'foo is true');
  t.equal(res.foosball, false, 'foo did not clobber');
  t.equal(res.bar, 20, 'bar is 20');
  t.end();
});

test('flag shortcuts', function (t) {
  var res = args(sampleArgs.concat('-f=10'), { options: ['foo'], booleans: ['bar'] });
  t.equal(res.foo, 10, 'foo is 10');
  t.equal(res.bar, false, 'bar default position is false');
  t.end();
});

test('auto camelcase', function (t) {
  var res = args(sampleArgs.concat('--foo-bar=10'), { options: 'fooBar' });
  t.equal(res.fooBar, 10, 'foo is 10');
  t.end();
});

test('full yargs control', function (t) {
  var res = args(sampleArgs.concat('--foo-bar=10'), {
    yargs: {
      bar: {
        alias: 'foo-bar',
        type: 'string'
      }
    }
  });
  t.equal(res.bar, '10', 'bar is a string 10');
  t.end();
});

test('full yargs features', function (t) {
  var res = args(sampleArgs.concat('--foo.bar=10'));
  t.equal(res.foo.bar, 10, 'foo object { bar is 10 }');
  t.end();
});

test('alias have precedence', function (t) {
  var res = args(sampleArgs.concat('-f=10'), { booleans: ['foo'], alias: { f: 'far' } });

  t.equal(res.foo, false, 'foo is false');
  t.equal(res.far, 10, 'alias won the value');
  t.end();
});

test('commands without config', function (t) {
  var res = args(sampleArgs.concat('run', '-f=10'));
  t.equal(res.$_, 'run', 'command defaulted to index');
  t.equal(res.f, 10, 'alias won the value');
  t.end();
});

test('commands with config', function (t) {
  var res = args(sampleArgs.concat('foo'), { commands: { foo: 'bar' } });
  t.equal(res.$_, 'bar', 'command found');
  t.deepEqual(res._, [], 'final args is empty');
  t.end();
});

test('commands shortcuts', function (t) {
  var res = args(sampleArgs.concat('f'), { commands: { foo: 'bar' } });
  t.equal(res.$_, 'bar', 'command found');
  t.end();
});

test('commands not found and defaults', function (t) {
  var res = args(sampleArgs.concat('zoo'), { commands: { foo: 'bar', _: 'default' } });
  t.equal(res.$_, 'default', 'command found');
  t.end();
});

test('command magic defaults work', function (t) {
  var res = args(sampleArgs.concat('-v'));
  t.equal(res.$_, ':::./version', 'version worked');

  var res2 = args(sampleArgs.concat('-h'));
  t.equal(res2.$_, ':::./help', 'help worked');
  t.end();
});

test('magic defaults don\'t eat user input', function (t) {
  var res = args(sampleArgs.concat('-v'), { booleans: ['version'] });
  // t.equal(res.$_, '.', 'command defaulted');
  t.equal(res.version, true, 'user version flag was kept');
  t.end();
});

test('options', function (t) {
  var res = args(sampleArgs.concat('-g', 'sed'), { options: ['grep'] });
  // t.equal(res.$_, '.', 'command defaulted');
  t.equal(res.grep, 'sed', 'option captured');
  t.end();
});

test('aliases options get abbreviated', function (t) {
  var res = args(sampleArgs.concat('-f', 'foo'), { options: ['grep'], alias: { filter: 'grep' } });
  t.equal(res.grep, 'foo', 'option captured');
  t.end();
});

test('aliases commands get abbreviated', function (t) {
  var res = args(sampleArgs.concat('f'), {
    commands: { grep: '.' },
    alias: { filter: 'grep' }
  });
  t.equal(res.$_, '.', 'command captured');
  t.end();
});