const toTasks = require('../cli/commands/protect/tasks');
const policy = require('snyk-policy');
const test = require('tap-only');
const Promise = require ('es6-promise').Promise; // jshint ignore:line
const proxyquire = require('proxyquire');
const sinon = require('sinon');

// fixtures
const fixturesFolder = `${__dirname}/fixtures/protect-apply-same-patch-again/`;
const wizardAnswers = require(fixturesFolder + '/answers.json');

const noop = function () {};

// spies
const execSpy = sinon.spy();
const writePatchFlagSpy = sinon.spy();
const writeSpy = sinon.spy();

//main proxy
const patch = proxyquire('../lib/protect/patch', {
  './get-vuln-source': function () {
    console.info(fixturesFolder);
    return fixturesFolder;
  },
  './write-patch-flag': proxyquire('../lib/protect/write-patch-flag', {
    'writePatchFlag': {
      writePatchFlag: (now, vuln) =>  {
        writePatchFlagSpy(now, vuln);
      }
    }
  }),
  // './write-patch-flag': function (now, vuln) {
  //   writePatchFlagSpy(now, vuln);
  //   return Promise.resolve(vuln);
  // },
  'then-fs': {
    rename: function (filename) {
      return Promise.resolve();
    },
    writeFile: function (filename, body) {
      writeSpy(filename, body);
      return Promise.resolve();
    },
    createWriteStream: function () {
      return {
        on: noop,
        end: noop,
        removeListener: noop,
        emit: noop,
      };
    },
  },
  './apply-patch': proxyquire('../lib/protect/apply-patch', {
    'child_process': {
      exec: function (a, b, callback) {
        // ignore dry run
        if (a.indexOf('--dry-run') === -1) {
          execSpy(a);
        }
        callback(null, '', ''); // successful patch
      }
    }
  })
});


test('same patch is not applied again to the same package', (t) => {
  console.info(`**************************\n Apply patch \n**************************\n `);

  const tasks = toTasks(wizardAnswers).patch;

  return patch(tasks, true)
    .then((res) => {
      console.info(`===> Write flag`);
      t.equal(writePatchFlagSpy.callCount, 1, 'Flag is written for first patch application');
    })
    .then(() => {
      console.info(`**************************\n Apply patch again \n**************************\n `);
      // 2nd test
      // try to apply patch again
      // make sure it is skipped
      // make sure write flag did not run this time
      return patch(tasks, true).then((res) => {
        console.info(`===> Write flag`);
        t.equal(writePatchFlagSpy.callCount, 1, 'Same patch is not applied again');
        t.equal(writePatchFlagSpy.callCount, 1, 'Flag is not written on second application of same patch');
      })
    })
    .catch();
});