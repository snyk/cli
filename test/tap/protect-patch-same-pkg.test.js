const { default: toTasks } = require('../../src/cli/commands/protect/tasks');
const test = require('tap').test;
const { getFixturePath } = require('../jest/util/getFixturePath');
const answers = require(getFixturePath('patch-same-package-answers.json'));
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const noop = function() {};

// spies
let execSpy = sinon.spy();
const renameSpy = sinon.spy();
const writeSpy = sinon.spy();

// main proxy
const patch = proxyquire('../../src/lib/protect/patch', {
  glob: function(pattern, options, cb) {
    cb(null, ['uglify.js.orig']);
  },
  './get-vuln-source': function() {
    return 'foo';
  },
  './write-patch-flag': function(now, vuln) {
    return Promise.resolve(vuln);
  },
  fs: {
    renameSync: function(filename) {
      renameSpy(filename);
    },
    writeFileSync: function(filename, body) {
      writeSpy(filename, body);
    },
    createWriteStream: function() {
      // fake event emitter (sort of)
      return {
        on: noop,
        end: noop,
        removeListener: noop,
        emit: noop,
      };
    },
  },
  './apply-patch': function(patch) {
    execSpy(patch);
    return Promise.resolve();
  },
});

test('if two patches for same package selected, only newest runs', function(t) {
  const latestId = 'uglify-js-20151024';
  const tasks = toTasks(answers).patch;
  return patch(tasks, true)
    .then(function(res) {
      t.equal(
        Object.keys(res.patch).length,
        tasks.length,
        'two vulns went in, two came out',
      );
      t.match(execSpy.args[0], new RegExp(latestId), 'correct patch picked');
      t.equal(execSpy.callCount, 1, 'patch only applied once');
    })
    .then(function() {
      // 2nd test
      execSpy = sinon.spy();
      return patch(tasks.reverse(), true).then(function() {
        t.match(
          execSpy.args[0],
          new RegExp(latestId),
          'correct patch picked (reversed)',
        );
        t.equal(execSpy.callCount, 1, 'patch only applied once (reversed)');
      });
    });
});

test('different patches are not affected', function(t) {
  const answers = require(getFixturePath('forever-answers.json'));
  execSpy = sinon.spy();
  return patch(toTasks(answers).patch, true).then(function() {
    t.equal(execSpy.callCount, 2, 'two patches applied');
  });
});
