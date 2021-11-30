import fs from 'fs';
import { test } from 'tap';
import path from 'path';
import policy from 'snyk-policy';

test('policy match logic', async (t) => {
  const rule = {
    'express-hbs > handlebars > uglify-js': {
      reason: 'None given',
      expires: '2016-03-01T19:49:50.633Z',
    },
    'handlebars > uglify-js': {
      reason: 'done this already',
      expires: '2016-03-01T19:53:46.310Z',
    },
  };

  const vulns = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './fixtures/jsbin-policy/jsbin.json'),
      'utf8',
    ),
  ).vulnerabilities;

  const vuln = vulns.filter((v) => v.id === 'npm:uglify-js:20150824').pop();

  const pathMatch = policy.matchToRule(vuln, rule);
  t.ok(pathMatch, 'vuln matches rule');
});

test('policy match (triggering not found)', async (t) => {
  const rule = {
    'glue > hapi > joi > moment': {
      patched: '2016-02-26T16:19:06.050Z',
    },
  };
  const vuln = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './fixtures/path-not-found.json'),
      'utf-8',
    ),
  );

  const pathMatch = policy.matchToRule(vuln, rule);
  t.equal(pathMatch, false, 'path does not match');
});
