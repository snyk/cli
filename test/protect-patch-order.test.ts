import fs from 'fs';
import { test } from 'tap';
import path from 'path';
import dedupe = require('../src/lib/protect/dedupe-patches');

test('protect patches in the correct order - SC-1076', async (t) => {
  try {
    const dir = __dirname + '/fixtures/bugs/SC-1076';
    const vulns = JSON.parse(
      fs.readFileSync(path.resolve(dir + '/vulns.json'), 'utf-8'),
    ).vulnerabilities;
    const res = dedupe(vulns);

    t.equal(
      res.packages[0].id,
      'npm:sequelize:20160329',
      'latest patch is picked',
    );
    t.equal(
      res.removed[0].id,
      'npm:sequelize:20160115',
      'old patch is removed',
    );
    t.pass('ok');
  } catch (e) {
    t.threw(e);
  }
});
