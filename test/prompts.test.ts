import * as fs from 'fs';
import { test } from 'tap';
const flattenDeep = require('lodash.flattendeep');
import * as path from 'path';
import * as sinon from 'sinon';
import * as inquirer from '@snyk/inquirer';

import wizard = require('../src/cli/commands/protect/wizard');

const sandbox = sinon.createSandbox();
const spy = sandbox.spy();

sandbox.stub(inquirer, 'prompt').callsFake((qs, cb) => {
  if (!cb) {
    cb = Promise.resolve.bind(Promise);
  }
  qs.forEach((q) => {
    if (q.name.indexOf('.') > -1) {
      throw Error('Dots are not allowed in answer names');
    }
  });
  return cb(spy(qs));
});

async function run(t, filename, offset = 0) {
  // this is for the snyk test question, note that it'll never add snyk protect
  // because the answers passed back from the inquirer.prompt will next actually
  // say if the user chose to patch
  offset += 1;
  spy.resetHistory();
  const vulns = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, filename), 'utf-8'),
  );

  try {
    const res = await (wizard as any).interactive(vulns);

    t.ok(!!res, 'prompts loaded');

    if (vulns.ok) {
      offset--; // since protect will be skipped if there's no vulns
    }
    const prompts = flattenDeep(spy.args);
    t.equal(
      prompts.length,
      vulns.vulnerabilities.length * 2 + offset,
      'found right number of prompts in ' + filename,
    );
    const testPrompt = prompts.find((prompt) => {
      return prompt.name === 'misc-add-test';
    });
    t.equal(testPrompt.default, false, 'test is not added by default');

    return prompts;
  } catch (e) {
    t.threw(e);
  }
}

test('dots in id', async (t) => {
  const prompts = await run(t, './fixtures/underscore.string.json');
  t.ok(contains(prompts![0], 'ignore'));
  t.ok(contains(prompts![0], 'skip'));
  t.ok(!contains(prompts![0], 'patch'));
  t.ok(!contains(prompts![0], 'update'));
});

test('review patches', async (t) => {
  const prompts = await run(t, './fixtures/uglify-patch-only.json', 2);

  t.ok(contains(prompts![0], 'review', true), 'review first');
  t.ok(contains(prompts![2], 'patch'), 'patch 2nd');
  t.ok(contains(prompts![4], 'patch'), 'patch 3rd');
});

test('direct update', async (t) => {
  const prompts = await run(t, './fixtures/hardy.json', 4);
  t.ok(contains(prompts![0], 'update'), 'update first');
  t.equal(
    prompts![0].choices[0].name,
    'Upgrade to cucumber@0.4.4 (triggers upgrade to syntax-error@1.1.1)',
    'has correct upgrade text',
  );
});

test('direct update post wizard', async (t) => {
  const prompts = await run(t, './fixtures/hardy-post-wizard.json', 2);
  t.ok(
    prompts!.some((p) => {
      return p.vuln && p.vuln.grouped && p.vuln.grouped.main;
    }),
    'has main grouping',
  );
  t.end();
});

test('patches also include (non-working) updates', async (t) => {
  const prompts = await run(t, './fixtures/uglify-contrived.json', 2);
  t.ok(hasText(prompts![0], 0, 'upgrade'), 'has upgrade');
  t.ok(contains(prompts![0], 'patch', true), 'has patch');
});

test('case 0: no remediation', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-0.json');
  t.ok(contains(prompts![0], 'ignore'));
});

test('case 1: direct update', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-1.json');
  t.ok(contains(prompts![0], 'update'));
  t.equal(
    prompts![0].choices[1].value.choice,
    'skip',
    'patch is not available, so should skip instead',
  );
});

test('case 2: indirect update', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-2.json');
  t.ok(contains(prompts![0], 'update'));
  t.equal(
    prompts![0].choices[1].value.choice,
    'skip',
    'patch is not available, so should skip instead',
  );
});

test('case 4: upgrades to different versions', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-4.json', 2);

  t.ok(contains(prompts![0], 'review'));
  t.ok(contains(prompts![0], 'update'));

  t.ok(contains(prompts![2], 'update'));
  t.equal(
    prompts![2].choices[1].value.choice,
    'skip',
    'patch is not available, so should skip instead',
  );

  t.ok(contains(prompts![4], 'update'));
  t.equal(
    prompts![4].choices[1].value.choice,
    'skip',
    'patch is not available, so should skip instead',
  );
});

test('case 5: two patches modify the same files', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-5.json', 2);
  t.ok(contains(prompts![0], 'review', true), 'review first');
  t.ok(contains(prompts![0], 'patch'), 'path in review');

  t.ok(contains(prompts![2], 'patch'));
  t.ok(contains(prompts![4], 'patch'));

  // first optional patch should be the latest one
  const a = prompts![2].choices[0].value.vuln.publicationTime;
  const b = prompts![4].choices[0].value.vuln.publicationTime;
  t.ok(a > b, 'publicationTime is ordered by newest');
});

test('case 5: two different patches modify the same files', async (t) => {
  const prompts = await run(t, './fixtures/scenarios/case-5.json', 2);

  t.ok(contains(prompts![0], 'review', true), 'review first');
  t.ok(contains(prompts![0], 'patch'), 'path in review');

  t.ok(contains(prompts![2], 'patch'));
  t.ok(contains(prompts![4], 'patch'));

  // first optional patch should be the latest one
  const a = prompts![2].choices[0].value.vuln.publicationTime;
  const b = prompts![4].choices[0].value.vuln.publicationTime;
  t.ok(a > b, 'publicationTime is ordered by newest');
});

test('humpback - checks related groups and subitems', async (t) => {
  // expecting 4 review sections (containing 2, 9, 3, 6) plus two stand alone
  const prompts = await run(t, './fixtures/scenarios/humpback.json', 4);

  const offset = 0;

  let tofind = null;
  for (let i = offset; i < prompts!.length; i += 2) {
    if (prompts![i].default === true) {
      continue;
    }
    const choices = prompts![i].choices;
    const group = choices && choices[prompts![i].default].value.vuln.grouped;
    if (group) {
      if (group.main) {
        tofind = group.id;
      } else {
        t.equal(tofind, group.requires, 'correct ordering on patch group');
      }
    }
  }
});

function contains(question, value, patchWithUpdate?) {
  const positions = {
    review: patchWithUpdate ? 2 : 1,
    patch: 1,
    update: 0,
    ignore: 2,
    skip: 3,
  };

  return question.choices[positions[value]].value.choice === value;
}

function hasText(question, position, value) {
  const index = question.choices[position].name
    .toLowerCase()
    .indexOf(value.toLowerCase());

  return index !== -1;
}

test('teardown', async () => {
  sandbox.restore();
});
