var test = require('tape');
var protect = require('../lib/protect');
var answers = require('./fixtures/deduped-dep/answers.json');

test('npm deduped packages are found and patched correctly', function (t) {
  protect.patch(answers, false, __dirname + '/fixtures/deduped-dep/').then(function (res) {
    t.equal(Object.keys(res.patch).length, 1, 'found and patched 1 file');
    t.end();
  }).catch(function (e) {
    console.log(e.stack);
    t.fail('failed to complete patch');
    t.end();
  });
});