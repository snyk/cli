var test = require('tap').test;
var protect = require('../src/lib/protect');
var answers = require('./fixtures/deduped-dep/answers.json');

test('npm deduped packages are found and patched correctly', function (t) {
  protect.patch(answers, false, __dirname + '/fixtures/deduped-dep/').then(function (res) {
    t.equal(Object.keys(res.patch).length, 1, 'found and patched 1 file');
  }).catch(t.threw).then(t.end);
});