'use strict';
var dist = require('./es5') ? 'dist' : 'lib';
require('es6-promise');
var test = require('tap-only');
var rimraf = require('rimraf');
var exec = require('child_process').exec;
var proxyquire = require('proxyquire').noPreserveCache();
var version = proxyquire('../../' + dist + '/version', {
  child_process: {
    exec: function exec(cmd, opts, callback) {
      // return on the stderr
      callback(null, '', 'cannot find ' + cmd);
    }
  }
});

test('test version exceptions', function (t) {
  return version(__dirname + '/../fixtures/dev-package').then(function (res) {
    t.equal(res, 'development', 'handled exceptions and returned dev');
  });
});

test('test version from totally different directory', function (t) {
  var root = __dirname + '/../../';
  var dir = __dirname + '/../fixtures/git-dir';
  var version = require(root + dist + '/version');
  process.chdir(dir);

  // init the .git dir
  exec('git init', { cwd: dir,
    env: {
      PATH: process.env.PATH,
      GIT_WORK_TREE: dir,
      GIT_DIR: dir + '/.git',
      GIT_INDEX_FILE: '',
    },
  }, function (err, stdout, stderr) {
    if (err) {
      console.log(err, stdout, stderr);
      t.fail('failed to git init');
    }

    version(root).then(function (res) {
      t.notEqual(res, 'development', 'managed to re navigate the directory');
    }).then(function () {
      return new Promise(function (resolve, reject) {
        process.chdir(root);
        rimraf(dir + '/.git', function (error) {
          if (error) {
            return reject(error);
          }
          resolve();
        });
      });
    }).catch(t.threw).then(t.end);
  });

});