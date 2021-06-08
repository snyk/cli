const _ = require('lodash');
const sinon = require('sinon');
const tap = require('tap');
const test = tap.test;

const cli = require('../cli/commands');
const snyk = require('..');

sinon.stub(snyk, 'test', function() {
  return require('./fixtures/more-vuln-paths-than-vulns');
});

tap.tearDown(function() {
  snyk.test.restore();
});

test('"snyk test --show-vulnerable-paths=false"', function(t) {
  const options = { 'show-vulnerable-paths': 'false' };
  return cli
    .test('more-vuln-paths-than-vulns', options)
    .then(function() {
      t.fail('Should have found vulns!');
    })
    .catch(function(res) {
      const vulnUrls = res.message
        .match(/^- info: (.*)$/gm)
        .map(function(result) {
          return result.replace(/^- info:\s*/, '');
        });
      t.assert(
        _(vulnUrls)
          .countBy() // count the occurrances of each vulnUrl
          .values()
          .every(function(occurances) {
            return occurances === 1;
          }),
        'displays each vuln only once',
      );

      t.assert(
        res.message.indexOf('Upgrade') === -1,
        'does not display upgrade information',
      );
      t.assert(
        res.message.indexOf('- from:') === -1,
        'does not display vulnerable paths',
      );
    });
});

test('"snyk test"', function(t) {
  return cli
    .test('more-vuln-paths-than-vulns')
    .then(function() {
      t.fail('Should have found vulns!');
    })
    .catch(function(res) {
      const vulnUrls = res.message
        .match(/^- info: (.*)$/gm)
        .map(function(result) {
          return result.replace(/^- info:\s*/, '');
        });
      t.assert(
        _(vulnUrls)
          .countBy() // count the occurrances of each vulnUrl
          .values()
          .some(function(occurances) {
            return occurances > 1;
          }),
        'duplicates vuln data for each vulnerable-path',
      );
      t.assert(
        res.message.indexOf('Upgrade') !== -1,
        'display upgrade information',
      );
      t.assert(
        res.message.indexOf('- from:') !== -1,
        'displays vulnerable paths',
      );
    });
});
