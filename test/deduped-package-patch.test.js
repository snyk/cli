var test = require('tap').test;
var protect = require('../src/lib/protect');
var answers = require('./fixtures/deduped-dep/answers.json');

test('npm deduped packages are found and patched correctly', async (t) => {
  process.chdir(__dirname + '/fixtures/deduped-dep/');
  const res = await protect.patch(answers, false);
  t.equal(Object.keys(res.patch).length, 1, 'found and patched 1 file');
  process.chdir(__dirname);
});
