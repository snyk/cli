import fs from 'fs';
import { test } from 'tap';
import path from 'path';
import policy from 'snyk-policy';

import { extendExpiries } from './utils';

test('ignored vulns do not turn up in tests', async (t) => {
  const dir = path.resolve(__dirname, './fixtures/jsbin-policy');
  const res = JSON.parse(
    fs.readFileSync(path.resolve(dir, 'jsbin.json'), 'utf-8'),
  );

  try {
    const config = await policy.load(dir);
    const start = res.vulnerabilities.length;
    t.equal(start, 8, 'initial vulns correct');

    extendExpiries(config);

    const newRes = config.filter(res, dir);

    // should strip:
    // - npm:handlebars:20151207
    // - npm:uglify-js:20150824
    t.equal(newRes.vulnerabilities.length, start - 2, 'post filter');
  } catch (e) {
    t.threw(e);
  }
});
