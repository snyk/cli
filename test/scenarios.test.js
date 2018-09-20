var test = require('tap').test;
var fs = require('then-fs');
var scenario = require('../src/cli/commands/scenario');

test('ensure scenarios work', function (t) {
  var setups = ['case-1', 'case-2', 'case-3'];
  var root = __dirname + '/fixtures/scenarios/';

  var promises = setups.map(function (s) {
    return Promise.all([
      scenario.loadScenario(root + s),
      fs.readFile(root + s + '.json', 'utf8')
    ]);
  });

  Promise.all(promises).then(function (res) {
    t.equal(res.length, setups.length);

    return res.map(function (res, i) {
      var target = JSON.parse(res[1]);
      // remove modification times
      removeModTime(res[0]);
      removeModTime(target);
      t.deepEqual(res[0], target, setups[i]);
    });
  }).catch(t.threw).then(t.end);

});

function removeModTime(t) {
  if (t.vulnerabilities) {
    (t.vulnerabilities || []).forEach(function (v) {
      (v.patches || []).forEach(function (p) {
        delete p.modificationTime;
      });
    });
  }
}