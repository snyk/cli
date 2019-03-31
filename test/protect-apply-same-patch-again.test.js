const test = require('tap').test;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const fs = require('then-fs');

const toTasks = require('../src/cli/commands/protect/tasks');
const writePatchFlag = require('../src/lib/protect/write-patch-flag');
const applyPatch = require('../src/lib/protect/apply-patch');
const debugNodeFileFixture = 'node-fixture.js';
const policy = require('snyk-policy');

// fixtures
const fixturesBaseFolder = __dirname +
  '/fixtures/protect-apply-same-patch-again/';
const fixturesModuleFolder = fixturesBaseFolder + 'src/';

const wizardAnswers = require(fixturesBaseFolder + 'answers.json');

const noop = function () {};

// spies
const writePatchFlagSpy = sinon.spy(writePatchFlag);
const applyPatchSpy = sinon.spy(applyPatch);

//main proxy
const patch = proxyquire('../src/lib/protect/patch', {
  './get-vuln-source': () => {
    return fixturesBaseFolder;
  },
  './write-patch-flag': writePatchFlagSpy,
  './apply-patch': applyPatchSpy,
});

test('setup', (t) => {
  var fixture = fs.readFileSync(fixturesModuleFolder + '/node-fixture.js');
  fs.writeFileSync(fixturesModuleFolder + '/node.js', fixture);
  t.pass();
  t.end();
});


test('Same patch is applied multiple times without issue', (t) => {
  t.teardown((t) => {
    fs.readdir(fixturesBaseFolder, (err, fileNames) => {
      const fixturesBaseFolderFiles = fileNames || [];

      if (err || fixturesBaseFolderFiles.length === 0) {
        console.log(`ERROR: Could not remove the .snyk-***.flag | ${err}`);
        return;
      }

      fixturesBaseFolderFiles.forEach((file) => {
        const flagMatch = file.match(/\.snyk.*\.flag/);
        if (flagMatch) {
          fs.unlink(fixturesBaseFolder + file);
        }
      });
    });

    fs.readdir(fixturesModuleFolder, (err, fileNames) => {
      const fixturesModuleFolderFiles = fileNames || [];

      if (err || fixturesModuleFolderFiles.length === 0) {
        return;
      }

      fixturesModuleFolderFiles.forEach((file) => {
        if (file !== debugNodeFileFixture) {
          fs.unlink(fixturesModuleFolder + file);
        }
      });
    });
  });

  // get wizard answers
  const tasks = toTasks(wizardAnswers).patch;

  // run patch based on wizard answers
  return patch(tasks, true)
    .then((res) => {
      const packagesToPatch = Object.keys(res.patch);
      t.equal(packagesToPatch.length, 1,
        'Two vulns went in for the same package but diff symlinked locations');
      t.equal(writePatchFlagSpy.callCount, 2,
        'Flag is written once for each of the 2 vulns');
      t.equal(applyPatchSpy.callCount, 2,
        'applyPatch is called once for each of the 2 vulns');
      // if all went well we should only have 1 package with 2 vulns
      // that need patching, both successfully patched

      const vulnsToPatch = res.patch[packagesToPatch[0]];
      var pacthedVulns = 0;
      vulnsToPatch.forEach((vuln) => {
        if (vuln[Object.keys(vuln)[0]].patched &&
          vuln[Object.keys(vuln)[0]].patched.length > 0) {
          pacthedVulns += 1;
        }
      });
      t.equal(vulnsToPatch.length, pacthedVulns, 'Every vuln is patched');
      t.pass();
      t.end();
    })
    .catch(t.fail);
});
