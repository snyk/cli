import * as fs from 'fs';
import { test } from 'tap';
import * as tryRequire from 'snyk-try-require';
import interactive = require('./wizard-instrumented');
import dedupePatches = require('../../src/lib/protect/dedupe-patches');
import answersToTasks from '../../src/cli/commands/protect/tasks';
import { getFixturePath } from '../jest/util/getFixturePath';

test('wizard prompts as expected', async (tapTest) => {
  tapTest.test('groups correctly (with oui package)', async (t) => {
    const responses = [
      // 17
      'default:patch',
      'default:patch',
      'default:patch', // 4
      'default:patch', // 2
      'default:patch', // 2
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      false,
      false,
    ];

    const vulns = JSON.parse(
      fs.readFileSync(getFixturePath('oui.json'), 'utf-8'),
    );

    try {
      const res = await interactive(vulns, responses);
      t.equal(res['misc-add-test'], false, 'should be false');
      t.equal(res['misc-add-protect'], false, 'should be false');
    } catch (e) {
      t.threw(e);
    }
  });

  tapTest.test('with ignore disabled', async (t) => {
    const responses = ['ignore'];

    const vulns = JSON.parse(
      fs.readFileSync(getFixturePath('oui.json'), 'utf-8'),
    );

    try {
      await interactive(vulns, responses, {
        ignoreDisabled: true,
        earlyExit: true,
      });

      t.fail('Should be invalid response');
    } catch (err) {
      t.ok(
        err.message.indexOf('missing prompt response') !== -1,
        'ignore is an invalid response',
      );
    }
  });

  tapTest.test('includes shrinkwrap when updating', async (t) => {
    const responses = [
      //
      'default:update', // 7
      'default:update', // 3
      'default:update', // 1
      'default:update', // 5
      'default:update', // 1
      'default:update', // 2
      'default:patch', // 2
      'default:patch', // 1
      'default:patch', // 1
      'default:patch', // 2
    ];

    const vulns = JSON.parse(
      fs.readFileSync(getFixturePath('mean.json'), 'utf-8'),
    );

    try {
      const pkg = await tryRequire(getFixturePath('pkg-mean-io/package.json'));
      const options = { pkg };

      const res = await interactive(vulns, responses, options);
      t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
    } catch (e) {
      t.threw(e);
    }
  });
});

test('wizard supports review and ignore (SC-943)', async (t) => {
  const responses = ['review', 'ignore', 'none given', 'skip'];

  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('scenarios/anna.json'), 'utf-8'),
  );

  try {
    const res = await interactive(vulns, responses, { earlyExit: true });
    t.equal(res['npm:uglify-js:20150824-u1'].choice, 'ignore');
  } catch (e) {
    t.threw(e);
  }
});

test('same name vulns do not get ignored (skipping in particular) (SC-1430)', async (t) => {
  const responses = ['default:patch', 'skip', 'y', 'n'];

  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('scenarios/SC-1430.json'), 'utf-8'),
  );

  try {
    const res = await interactive(vulns, responses);
    t.equal(Object.keys(res).length, 4, 'four prompts were answered');
  } catch (e) {
    t.threw(e);
  }
});

test('ignored grouped update explodes into multiple rules (SC-959)', async (t) => {
  const responses = ['ignore', 'none given', 'skip'];

  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('scenarios/explode-ignore.json'), 'utf-8'),
  );

  try {
    const answers = await interactive(vulns, responses, { earlyExit: true });
    const tasks = answersToTasks(answers);

    t.equal(
      tasks.ignore.length,
      vulns.vulnerabilities.length,
      'should ignore all vulns',
    );
  } catch (e) {
    t.threw(e);
  }
});

test('patch grouped vuln should run multiple patches (SC-1109)', async (t) => {
  const responses = ['default:patch', 'default:ignore', 'none given'];

  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('scenarios/SC-1109.json'), 'utf-8'),
  );

  try {
    const answers = await interactive(vulns, responses, { earlyExit: true });

    const tasks = answersToTasks(answers);
    const filenames = tasks.patch.map((_: any) => {
      // trim the filename to remove the common path
      return _.__filename.replace(/.*\/node_modules\/tap\/node_modules\//, '');
    });

    t.notEqual(filenames[0], filenames[1], 'filenames should not be the same');

    // now it should only patch those files
    const patches = dedupePatches(tasks.patch);

    t.equal(patches.packages.length, 2, '2 patches remain');
    t.equal(patches.packages[0].patches.id, 'patch:npm:request:20160119:0');
    t.equal(patches.packages[1].patches.id, 'patch:npm:request:20160119:4');
  } catch (e) {
    t.threw(e);
  }
});

test('vulns from extraneous deps are patched (SC-3560)', async (t) => {
  const responses = ['default:update', 'default:patch', 'default:patch'];

  const vulns = require(getFixturePath('scenarios/SC-3560.json'));

  try {
    const answers = await interactive(vulns, responses, { earlyExit: true });
    const tasks: any = answersToTasks(answers);
    t.equal(tasks.update[0].id, 'npm:jquery:20150627', 'prod jquery updated');
    t.equal(tasks.update.length, 1, '1 update');
    t.equal(tasks.patch[0].id, 'npm:ms:20170412', 'extraneous ms patched');
    t.equal(tasks.patch[1].id, 'npm:qs:20170213', 'extraneous qs patched');
    t.equal(tasks.patch.length, 2, '2 patches');
  } catch (e) {
    t.threw(e);
  }
});

test('yarn reinstall is not a valid option', async (t) => {
  const responses = ['default:update'];

  const vulns = JSON.parse(
    fs.readFileSync(getFixturePath('oui-wizard-reinstall.json'), 'utf-8'),
  );

  try {
    const answers = await interactive(vulns, responses, {
      packageManager: 'npm',
      earlyExit: true,
    });
    t.equal(
      answers['npm:connect:20130701-u0'].choice,
      'update',
      'reinstall is available for npm projects',
    );
    await interactive(vulns, responses, {
      packageManager: 'yarn',
      earlyExit: true,
    });
  } catch (err) {
    t.equal(
      err.message,
      'default did not match on npm:connect:20130701-u0, skip != update',
      'reinstall is not provided as an option for yarn projects',
    );
  }
});
