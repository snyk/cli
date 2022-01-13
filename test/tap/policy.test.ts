import * as policy from 'snyk-policy';
import { test } from 'tap';
import { extendExpiries } from '../utils';
import { getFixturePath } from '../jest/util/getFixturePath';

test('policy is callable with string', async (t) => {
  const dir = getFixturePath('jsbin-snyk-config');
  try {
    await policy.load(dir);
    t.pass('called with string');
    t.end();
  } catch (e) {
    t.fail(e);
  }
});

test('policy is callable with array', async (t) => {
  const dir = getFixturePath('jsbin-snyk-config');
  try {
    await policy.load([dir]);
    t.pass('called with array');
    t.end();
  } catch (e) {
    t.fail(e);
  }
});

test('policy is callable with string and options', async (t) => {
  const dir = getFixturePath('jsbin-snyk-config');
  try {
    await policy.load(dir, { 'ignore-policy': true });
    t.pass('called with string and options');
    t.end();
  } catch (e) {
    t.fail(e);
  }
});

test('test sensibly bails if gets an old .snyk format', async (t) => {
  const dir = getFixturePath('jsbin-snyk-config');
  const vulns = require(getFixturePath('test-jsbin-vulns-updated.json'));
  const id = 'npm:semver:20150403';
  const vuln = vulns.vulnerabilities
    .filter((v) => {
      return v.id === id;
    })
    .pop();
  try {
    const config = await policy.load(dir);
    const rule = policy.getByVuln(config, vuln);
    t.equal(id, rule.id);
    t.equal(rule.type, 'ignore', 'rule is correctly flagged as ignore');

    const notfound = policy.getByVuln(config, 'unknown');
    t.equal(notfound, null, 'unknown policies are null');
    t.end();
  } catch (e) {
    console.log(e.stack);
    t.fail('could not load the policy file');
    t.end();
  }
});

test('policy ignores correctly', async (t) => {
  const dir = getFixturePath('hapi-azure-post-update');
  const vulns = require(dir + '/test.json');

  try {
    const config = await policy.load(dir);
    // strip the ignored modules from the results
    extendExpiries(config);
    const vuln = config.filter(vulns);
    t.equal(vuln.vulnerabilities.length, 2, 'only qs vuln should remain');
    t.end();
  } catch (e) {
    console.log(e.stack);
    t.fail('could not load the policy file');
    t.end();
  }
});
