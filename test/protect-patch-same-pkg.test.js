var toTasks = require('../src/cli/commands/protect/tasks');
var test = require('tap').test;
var answers = require(__dirname + '/fixtures/patch-same-package-answers.json');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var noop = function () {};

// spies
var execSpy = sinon.spy();
var renameSpy = sinon.spy();
var writeSpy = sinon.spy();

// main proxy
var patch = proxyquire('../src/lib/protect/patch', {
  'recursive-readdir': function (source, cb) {
    cb(null, ['uglify.js.orig']);
  },
  './get-vuln-source': function () {
    return 'foo';
  },
  './write-patch-flag': function (now, vuln) {
    return Promise.resolve(vuln);
  },
  'then-fs': {
    rename: function (filename) {
      renameSpy(filename);
      return Promise.resolve();
    },
    writeFile: function (filename, body) {
      writeSpy(filename, body);
      return Promise.resolve();
    },
    createWriteStream: function () {
      // fake event emitter (sort of)
      return {
        on: noop,
        end: noop,
        removeListener: noop,
        emit: noop,
      };
    },
  },
  './apply-patch': function (patch) {
    execSpy(patch);
    return Promise.resolve();
  }
});

test('if two patches for same package selected, only newest runs', function (t) {
  var latestId = 'uglify-js-20151024';
  var tasks = toTasks(answers).patch;
  return patch(tasks, true).then(function (res) {
    t.equal(Object.keys(res.patch).length, tasks.length, 'two vulns went in, two came out');
    t.match(execSpy.args[0], new RegExp(latestId), 'correct patch picked');
    t.equal(execSpy.callCount, 1, 'patch only applied once');
  }).then(function () {
    // 2nd test
    execSpy = sinon.spy();
    return patch(tasks.reverse(), true).then(function () {
      t.match(execSpy.args[0], new RegExp(latestId), 'correct patch picked (reversed)');
      t.equal(execSpy.callCount, 1, 'patch only applied once (reversed)');
    });
  });
});

test('different patches are not affected', function (t) {
  var answers = require(__dirname + '/fixtures/forever-answers.json');
  execSpy = sinon.spy();
  return patch(toTasks(answers).patch, true).then(function () {
    t.equal(execSpy.callCount, 2, 'two patches applied');
  });
});
