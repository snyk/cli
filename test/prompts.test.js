var debug = require('debug')('snyk');
var test = require('tape');
var getPrompts = require('../cli/commands/protect/prompts').getPrompts;

test('review patches', function (t) {
  var vulns = require('./fixtures/uglify-patch-only.json').vulnerabilities;
  var prompts = getPrompts(vulns);

  t.ok(!!prompts, 'prompts actually loaded');
  t.equal(prompts.length, vulns.length * 2 + 2, 'found right number of prompts');
  t.ok(contains(prompts[0], 'review'));
  t.ok(contains(prompts[2], 'patch'));
  t.ok(contains(prompts[4], 'patch'));

  t.end();
});

test('case 1: direct update', function (t) {
  var vulns = require('./fixtures/scenarios/case-1.json').vulnerabilities;
  var prompts = getPrompts(vulns);

  t.ok(!!prompts, 'prompts actually loaded');
  t.equal(prompts.length, vulns.length * 2, 'found right number of prompts');
  t.ok(contains(prompts[0], 'update'));
  t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
  t.end();
});

test('case 2: indirect update', function (t) {
  var vulns = require('./fixtures/scenarios/case-2.json').vulnerabilities;
  var prompts = getPrompts(vulns);

  t.ok(!!prompts, 'prompts actually loaded');
  t.equal(prompts.length, vulns.length * 2, 'found right number of prompts');
  t.ok(contains(prompts[0], 'update'));
  t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
  t.end();
});

test('case 4: upgrades to different versions', function (t) {
  var vulns = require('./fixtures/scenarios/case-4.json').vulnerabilities;
  var prompts = getPrompts(vulns);

  t.ok(!!prompts, 'prompts actually loaded');
  t.equal(prompts.length, vulns.length * 2 + 2, 'found right number of prompts');

  t.ok(contains(prompts[0], 'review'));
  t.ok(contains(prompts[0], 'update'));

  t.ok(contains(prompts[2], 'update'));
  t.equal(prompts[2].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');

  t.ok(contains(prompts[4], 'update'));
  t.equal(prompts[4].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');


  t.end();
});


test('case 5: two patches modify the same files', function (t) {
  var vulns = require('./fixtures/scenarios/case-5.json').vulnerabilities;
  var prompts = getPrompts(vulns);

  t.equal(prompts.length, vulns.length * 2 + 2, 'found right number of prompts');
  t.ok(contains(prompts[0], 'review'));
  t.ok(contains(prompts[0], 'patch'));

  t.ok(contains(prompts[2], 'patch'));
  t.ok(contains(prompts[4], 'patch'));

  // first optional patch should be the latest one
  var a = prompts[2].choices[0].value.vuln.publicationTime;
  var b = prompts[4].choices[0].value.vuln.publicationTime;
  t.ok(a > b, 'publicationTime is ordered by newest');

  t.end();
});

function contains(question, value, patchWithUpdate) {
  var positions = {
    review: 1,
    patch: patchWithUpdate ? 1 : 0,
    update: 0,
    ignore: 2,
    skip: 3,
  };

  debug(question.choices[positions[value]].value.choice);
  // showChoices(question);

  return question.choices[positions[value]].value.choice === value;
}

function showChoices(question) {
  console.log(question.choices.map(function (v) {
    return v.value.choice;
  }));
}