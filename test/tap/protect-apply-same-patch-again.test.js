const test = require('tap').test;
const proxyquire = require('proxyquire');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const { getFixturePath } = require('../jest/util/getFixturePath');

const { default: toTasks } = require('../../src/cli/commands/protect/tasks');
const writePatchFlag = require('../../src/lib/protect/write-patch-flag');
const applyPatch = require('../../src/lib/protect/apply-patch');
const debugNodeFileFixture = 'node-fixture.js';

const fixturesBaseFolder = getFixturePath('protect-apply-same-patch-again');
const fixturesModuleFolder = path.resolve(fixturesBaseFolder, 'src');
const transitiveDepsFolder = path.resolve(fixturesBaseFolder, 'node_modules');
const alreadyPatchedTransitiveDepFolder = path.resolve(
  transitiveDepsFolder,
  'already_patched_dep',
);

const wizardAnswers = require(path.resolve(fixturesBaseFolder, 'answers.json'));

// spies
const writePatchFlagSpy = sinon.spy(writePatchFlag);
const applyPatchSpy = sinon.spy(applyPatch);

//main proxy
const patch = proxyquire('../../src/lib/protect/patch', {
  './get-vuln-source': () => {
    return fixturesBaseFolder;
  },
  './write-patch-flag': writePatchFlagSpy,
  './apply-patch': applyPatchSpy,
});

// create a fixture for a transitive dep that has been patched
const transitiveDepCodeFilePath = path.resolve(
  alreadyPatchedTransitiveDepFolder,
  'somecode.js',
);
const transitiveDepCodeContent = 'console.log("some patched code here")';
const transitiveDepBackupFilePath = path.resolve(
  alreadyPatchedTransitiveDepFolder,
  'somecode.js.orig',
);
const transitiveDepBackupContent = 'console.log("some original code here")';
const transitiveDepPatchFlagPath = path.resolve(
  alreadyPatchedTransitiveDepFolder,
  '.some-vuln-id.flag',
);
const transitiveDepPatchFlagContent = new Date().toISOString();

test('setup', (t) => {
  const fixture = fs.readFileSync(
    path.resolve(fixturesModuleFolder, 'node-fixture.js'),
  );
  fs.writeFileSync(path.resolve(fixturesModuleFolder, 'node.js'), fixture);

  // create transitive dep that looks like it was patched
  rimraf.sync(transitiveDepsFolder);
  fs.mkdirSync(transitiveDepsFolder);
  fs.mkdirSync(alreadyPatchedTransitiveDepFolder);
  fs.writeFileSync(transitiveDepCodeFilePath, transitiveDepCodeContent);
  fs.writeFileSync(transitiveDepBackupFilePath, transitiveDepBackupContent);
  fs.writeFileSync(transitiveDepPatchFlagPath, transitiveDepPatchFlagContent);

  t.pass('Setup ok');
  t.end();
});

test('Same patch is applied multiple times without issue', (t) => {
  t.teardown(() => {
    fs.readdir(fixturesBaseFolder, (err, fileNames) => {
      const fixturesBaseFolderFiles = fileNames || [];

      if (err || fixturesBaseFolderFiles.length === 0) {
        console.log(`ERROR: Could not remove the .snyk-***.flag | ${err}`);
        return;
      }

      fixturesBaseFolderFiles.forEach((file) => {
        const flagMatch = file.match(/\.snyk.*\.flag/);
        if (flagMatch) {
          fs.unlinkSync(path.join(fixturesBaseFolder, file));
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
          fs.unlinkSync(path.join(fixturesModuleFolder, file));
        }
      });
    });

    rimraf.sync(transitiveDepsFolder);
  });

  // get wizard answers
  const tasks = toTasks(wizardAnswers).patch;

  // run patch based on wizard answers
  return patch(tasks, true)
    .then((res) => {
      const packagesToPatch = Object.keys(res.patch);
      t.equal(
        packagesToPatch.length,
        1,
        'Two vulns went in for the same package but diff symlinked locations',
      );
      t.equal(
        writePatchFlagSpy.callCount,
        2,
        'Flag is written once for each of the 2 vulns',
      );
      t.equal(
        applyPatchSpy.callCount,
        2,
        'applyPatch is called once for each of the 2 vulns',
      );
      // if all went well we should only have 1 package with 2 vulns
      // that need patching, both successfully patched

      const vulnsToPatch = res.patch[packagesToPatch[0]];
      let patchedVulns = 0;
      vulnsToPatch.forEach((vuln) => {
        if (
          vuln[Object.keys(vuln)[0]].patched &&
          vuln[Object.keys(vuln)[0]].patched.length > 0
        ) {
          patchedVulns += 1;
        }
      });
      t.equal(vulnsToPatch.length, patchedVulns, 'Every vuln is patched');

      // assert that patched transitive deps were not restored to their pre-patched state
      t.ok(
        fs.existsSync(transitiveDepBackupFilePath),
        'backup of transitive dep found',
      );
      t.ok(
        fs.existsSync(transitiveDepCodeFilePath),
        'code of transitive dep found',
      );
      t.ok(
        fs.existsSync(transitiveDepPatchFlagPath),
        'patch flag of transitive dep found',
      );
      t.equal(
        fs.readFileSync(transitiveDepBackupFilePath).toString(),
        transitiveDepBackupContent,
        'backup of transitive dep unaltered',
      );
      t.equal(
        fs.readFileSync(transitiveDepCodeFilePath).toString(),
        transitiveDepCodeContent,
        'code of transitive dep unaltered',
      );

      t.pass('All ok');
      t.end();
    })
    .catch(t.fail);
});
