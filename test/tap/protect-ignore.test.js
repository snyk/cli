const filter = require('snyk-policy').filter;
const test = require('tap').test;
const { getFixturePath } = require('../jest/util/getFixturePath');
const vulns = require(getFixturePath('test-jsbin-vulns.json'));

function runFilterShared(res, path, date) {
  const rule = { 'node-semver-63': [{}] };
  rule['node-semver-63'][0][path] = {
    expires: (date || new Date(Date.now() + 1000 * 60 * 60 * 24)).toJSON(),
    reason: 'none given',
  };

  return filterIgnored(rule, res.vulnerabilities);
}

function filterIgnored(rule, vulns) {
  const res = filter(
    {
      ok: false,
      vulnerabilities: vulns,
    },
    { ignore: rule },
  );
  return res.vulnerabilities || [];
}

// skipped intentially - only used for debugging tests
test(
  'protect correctly filters (single)',
  function(t) {
    t.plan(1);
    Promise.resolve(vulns)
      .then(function(res) {
        // exact match
        const total = res.vulnerabilities.length;
        const runFilter = runFilterShared.bind(null, res);
        const vulns = runFilter('*');
        t.equal(vulns.length, total - 1, 'removed with * _only_ rule');
      })
      .catch(function(e) {
        console.log(e.stack);
        t.fail(e);
      });
  },
  { skip: true },
);

test('protect correctly filters', function(t) {
  Promise.resolve(vulns)
    .then(function(res) {
      // exact match
      const total = res.vulnerabilities.length;
      let vulns;
      const runFilter = runFilterShared.bind(null, res);

      vulns = runFilter('sqlite3@2.2.7 > node-pre-gyp@0.5.22 > semver@3.0.1');
      t.equal(vulns.length, total - 1, 'removed matched vuln');

      vulns = runFilter('sqlite3 > node-pre-gyp > semver');
      t.equal(vulns.length, total - 1, 'removed with range (@-less)');

      vulns = runFilter('sqlite3@* > node-pre-gyp@* > semver@*');
      t.equal(vulns.length, total - 1, 'removed with range (with @*)');

      vulns = runFilter(
        'sqlite3@2.2.7 > node-pre-gyp@0.5.22 > semver@3.0.1',
        new Date(Date.now() - 1000 * 60 * 60 * 24),
      );
      t.equal(vulns.length, total, 'expired rule is ignored');

      vulns = runFilter('* > semver@3.0.1');
      t.equal(vulns.length, total - 1, 'removed with * rule');

      vulns = runFilter('sqlite3 > * > semver@*');
      t.equal(vulns.length, total - 1, 'mixed *, @-less and latest');

      vulns = runFilter('*');
      t.equal(vulns.length, total - 1, 'removed with * _only_ rule');

      vulns = runFilter('sqlite3 > * > semver@5');
      t.equal(vulns.length, total, 'no match');

      t.end();
    })
    .catch(t.threw);
});

test('ignores real vuln data', function(t) {
  const vulns2 = require(getFixturePath(
    'test-jsbin-vulns-updated.json',
  )).vulnerabilities.filter(function(v) {
    return v.id === 'npm:uglify-js:20150824' || v.id === 'npm:semver:20150403';
  });
  const policy = require('snyk-policy');

  t.plan(1);
  policy
    .load(getFixturePath('jsbin-snyk-config'))
    .then(function(config) {
      return filterIgnored(config.ignore, vulns2);
    })
    .then(function(res) {
      t.equal(res.length, 0, 'all vulns have been ignored');
    })
    .catch(function(e) {
      console.log(e.stack);
      t.fail(e);
    });
});
