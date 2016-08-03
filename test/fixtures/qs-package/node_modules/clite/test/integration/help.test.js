'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require('../../');
var fs = require('fs');
var help = fs.readFileSync(fixtures + '/basic-clite/help/index.txt', 'utf8');
var opts = {
  help: {
    _: 'help/index.txt',
    foo: 'help/foo.txt'
  }
};

test('errors on help', function (t) {
  process.argv = sampleArgs.concat('--help');
  return clite({}, fixtures + '/basic-clite').catch(function (e) {
    t.match(e.message, /no help configured/i, 'warns on no help');
  });
});

test('finds help', function (t) {
  process.argv = sampleArgs.concat('--help');
  return clite({
    help: 'help/index.txt'
  }, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, help, 'loaded correct help');
  });
});

test('finds shortcut help', function (t) {
  process.argv = sampleArgs.concat('-h');
  return clite({
    help: 'help/index.txt'
  }, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, help, 'loaded correct help');
  });
});

test('finds default help', function (t) {
  process.argv = sampleArgs.concat('--help');
  return clite(opts, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, help, 'found default help from `_`');
  });
});

test('finds specific help', function (t) {
  process.argv = sampleArgs.concat('--help', 'foo');
  return clite(opts, fixtures + '/basic-clite').then(function (res) {
    t.equal(res, 'foo', 'loaded specific help');
  });
});

test('errors on unknown help', function (t) {
  process.argv = sampleArgs.concat('--help', 'bar');
  return clite(opts, fixtures + '/basic-clite').catch(function (e) {
    t.match(e.message, /"bar" help/i, 'warns on missing help');
  });
});

test('throws with help with no command', function (t) {
  process.argv = sampleArgs.slice(0);
  return clite(opts, fixtures + '/basic-clite').then(function (res) {
    t.fail('did not want: ' + res);
  }).catch(function (e) {
    t.equal(e.code, 'BAD_ARGS', 'bad arguments');
    t.match(e.message, /This is the help/i, 'configured help shown');
  });
});

test('throws with generated help with no command', function (t) {
  process.argv = sampleArgs.slice(0);
  return clite({}, fixtures + '/basic-clite').then(function (res) {
    t.fail('did not want: ' + res);
  }).catch(function (e) {
    t.equal(e.code, 'BAD_ARGS', 'bad arguments');
    t.match(e.message, /Options:\s+--version/im, 'generated help shown');
  });
});

test('user can trigger usage error', function (t) {
  process.argv = sampleArgs.slice(0);
  return clite({
    commands: { _: './err' },
    help: opts.help
  }, fixtures + '/basic-clite').then(function (res) {
    t.fail('did not want: ' + res);
  }).catch(function (e) {
    t.equal(e.code, 'BAD_ARGS', 'bad arguments');
    t.match(e.message, /This did not work/i, 'user error shown');
  });
});