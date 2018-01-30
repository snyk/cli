const toTasks = require('../cli/commands/protect/tasks');
const policy = require('snyk-policy');
const test = require('tap-only');
const Promise = require ('es6-promise').Promise; // jshint ignore:line
const proxyquire = require('proxyquire');
const sinon = require('sinon');

// fixtures
const fixturesFolder = `${__dirname}/fixtures/protect-apply-same-patch-again/`;
const wizardAnswers = require(fixturesFolder + 'answers.json');

const noop = function () {};

// spies
const execSpy = sinon.spy();
const writePatchFlagSpy = sinon.spy();
const writeSpy = sinon.spy();

//main proxy
const patch = proxyquire('../lib/protect/patch', {
  './get-vuln-source': () => {
    console.info(fixturesFolder);
    return fixturesFolder;
  },
  './write-patch-flag': proxyquire('../lib/protect/write-patch-flag', {
      writePatchFlag: (now, vuln) =>  {
        writePatchFlagSpy(now, vuln);
      }
  }),
  'then-fs': {
    rename: (filename) => {
      return Promise.resolve();
    },
    writeFile: (filename, body) => {
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
      exec: (a, b, callback) => {
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
      console.log(`writePatchFlagSpy.callCount ${writePatchFlagSpy.callCount}`);
        t.equal(writePatchFlagSpy.calledOnce, 'Flag is written only once still');
    })
    .then(() => {
      console.info(`**************************\n Apply patch again \n**************************\n `);
      // 2nd test
      // try to apply patch again
      // make sure write flag did not run this time
      return patch(tasks, true).then((res) => {
        console.log(`writePatchFlagSpy.callCount ${writePatchFlagSpy.callCount}`);
        t.equal(writePatchFlagSpy.calledOnce, 'Flag is not written again');
      })
    })
    .catch();
});