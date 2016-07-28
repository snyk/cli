'use strict';

var test = require('tap-only');
var sampleArgs = ['node', 'script.js'];
var fixtures = __dirname + '/../fixtures';
var clite = require('../../');

test('should not echo on empty resolve', function (t) {
  process.argv = sampleArgs.slice();
  var logged = false;
  console.log = function (s) {
    logged = true;
    t.fail('logged: ' + s);
  };

  return clite({
    commands: { _ : 'echo' },
    return: false,
  }, fixtures + '/basic-clite').then(function () {
    t.notOk(logged, 'kept silent as expected');
  });
});