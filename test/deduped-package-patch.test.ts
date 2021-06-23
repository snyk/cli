import { test } from 'tap';
const protect = require('../src/lib/protect');
import * as fs from 'fs';

test('npm deduped packages are found and patched correctly', async (t) => {
  let answers;
  try {
    answers = JSON.parse(
      fs.readFileSync(__dirname + '/fixtures/deduped-dep/answers.json', 'utf8'),
    );
  } catch (err) {
    t.fail(`Could not read json file: ${err}`);
  }

  process.chdir(__dirname + '/fixtures/deduped-dep/');
  const res = await protect.patch(answers, false);
  t.equal(Object.keys(res.patch).length, 1, 'found and patched 1 file');
  process.chdir(__dirname);
});
