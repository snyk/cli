var debug = require('debug')('snyk');
var test = require('tap').test;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var _ = require('lodash');
var spy = sinon.spy();
var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  inquirer: {
    prompt: function (qs, cb) {
      if (!cb) {
        cb = Promise.resolve.bind(Promise);
      }
      qs.forEach(function(q) {
        if (q.name.indexOf('.') > -1) {
          throw Error('Dots are not allowed in answer names');
        }
      });
      return cb(spy(qs));
    },
  }
});
var getPrompts = wizard.interactive;

function run(t, offset, filename) {
  if (typeof offset === 'string') {
    filename = offset;
    offset = 0;
  }
  // this is for the snyk test question, note that it'll never add snyk protect
  // because the answers passed back from the inquirer.prompt will next actually
  // say if the user chose to patch
  offset += 1;
  spy.resetHistory();
  var vulns = require(filename);
  return getPrompts(vulns).then(function (a) {
    t.ok(!!a, 'prompts loaded');
    if (vulns.ok) {
      offset--; // since protect will be skiped if there's no vulns
    }
    var prompts = _.flattenDeep(spy.args);
    t.equal(prompts.length, vulns.vulnerabilities.length * 2 + offset, 'found right number of prompts in ' + filename);
    var testPrompt = prompts.find(function (prompt) {
      return prompt.name === 'misc-add-test';
    });
    t.equal(testPrompt.default, false, 'test is not added by default');
    return prompts;
  }).catch(function (e) {
    console.log(e.stack);
    t.bail(e);
  });
}

test('dots in id', function (t) {
  run(t, './fixtures/underscore.string.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'ignore'));
    t.ok(contains(prompts[0], 'skip'));
    t.ok(!contains(prompts[0], 'patch'));
    t.ok(!contains(prompts[0], 'update'));
    t.end();
  });
});

test('review patches', function (t) {
  run(t, 2, './fixtures/uglify-patch-only.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review', true), 'review first');
    t.ok(contains(prompts[2], 'patch'), 'patch 2nd');
    t.ok(contains(prompts[4], 'patch'), 'patch 3rd');
    t.end();
  });
});

test('direct update', function (t) {
  run(t, 4, './fixtures/hardy.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'update'), 'update first');
    t.equal(prompts[0].choices[0].name, 'Upgrade to cucumber@0.4.4 (triggers upgrade to syntax-error@1.1.1)', 'has correct upgrade text');
    t.end();
  });
});

test('direct update post wizard', function (t) {
  run(t, 2, './fixtures/hardy-post-wizard.json').then(function (prompts) {
    t.ok(prompts.some(function (p) {
      return p.vuln && p.vuln.grouped && p.vuln.grouped.main;
    }), 'has main grouping');
    t.end();
  }).catch(function (e) {
    console.log(e.stack);
    t.end();
  });
});


test('patches also include (non-working) updates', function (t) {
  run(t, 2, './fixtures/uglify-contrived.json').then(function (prompts) {
    t.ok(hasText(prompts[0], 0, 'upgrade'), 'has upgrade');
    t.ok(contains(prompts[0], 'patch', true), 'has patch');
    t.end();
  });
});

test('case 0: no remediation', function (t) {
  run(t, './fixtures/scenarios/case-0.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'ignore'));
    t.end();
  });
});

test('case 1: direct update', function (t) {
  run(t, './fixtures/scenarios/case-1.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'update'));
    t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
    t.end();
  });
});

test('case 2: indirect update', function (t) {
  run(t, './fixtures/scenarios/case-2.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'update'));
    t.equal(prompts[0].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');
    t.end();
  });
});

test('case 4: upgrades to different versions', function (t) {
  run(t, 2, './fixtures/scenarios/case-4.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review'));
    t.ok(contains(prompts[0], 'update'));

    t.ok(contains(prompts[2], 'update'));
    t.equal(prompts[2].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');

    t.ok(contains(prompts[4], 'update'));
    t.equal(prompts[4].choices[1].value.choice, 'skip', 'patch is not available, so should skip instead');

    t.end();
  });
});


test('case 5: two patches modify the same files', function (t) {
  run(t, 2, './fixtures/scenarios/case-5.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review', true), 'review first');
    t.ok(contains(prompts[0], 'patch'), 'path in review');

    t.ok(contains(prompts[2], 'patch'));
    t.ok(contains(prompts[4], 'patch'));

    // first optional patch should be the latest one
    var a = prompts[2].choices[0].value.vuln.publicationTime;
    var b = prompts[4].choices[0].value.vuln.publicationTime;
    t.ok(a > b, 'publicationTime is ordered by newest');

    t.end();
  });
});

test('case 5: two different patches modify the same files', function (t) {
  run(t, 2, './fixtures/scenarios/case-5.json').then(function (prompts) {
    t.ok(contains(prompts[0], 'review', true), 'review first');
    t.ok(contains(prompts[0], 'patch'), 'path in review');

    t.ok(contains(prompts[2], 'patch'));
    t.ok(contains(prompts[4], 'patch'));

    // first optional patch should be the latest one
    var a = prompts[2].choices[0].value.vuln.publicationTime;
    var b = prompts[4].choices[0].value.vuln.publicationTime;
    t.ok(a > b, 'publicationTime is ordered by newest');

    t.end();
  });
});

test('humpback - checks related groups and subitems', function (t) {
  // expecting 4 review sections (containing 2, 9, 3, 6) plus two stand alone
  run(t, 4, './fixtures/scenarios/humpback.json').then(function (prompts) {
    var offset = 0;

    var tofind = null;
    for (var i = offset; i < prompts.length; i += 2) {
      if (prompts[i].default === true) {
        continue;
      }
      var choices = prompts[i].choices;
      var group = choices && choices[prompts[i].default].value.vuln.grouped;
      if (group) {
        if (group.main) {
          tofind = group.id;
        } else {
          t.equal(tofind, group.requires, 'correct ordering on patch group');
        }
      }
    }

    t.end();
  }).catch(t.threw);
});

function contains(question, value, patchWithUpdate) {
  var positions = {
    review: patchWithUpdate ? 2 : 1,
    patch: 1,
    update: 0,
    ignore: 2,
    skip: 3,
  };

  showChoices(question);
  debug(question.choices[positions[value]].value.choice);

  return question.choices[positions[value]].value.choice === value;
}

function hasText(question, position, value) {
  debug(question.choices[position].name.toLowerCase(), value.toLowerCase());
  var index = question.choices[position].name.toLowerCase().indexOf(value.toLowerCase());
  debug(index);
  // showChoices(question);

  return index !== -1;
}

function showChoices(question) {
  // console.log(question.choices.map(function (v) {
  //   return v;
  // }));
}
