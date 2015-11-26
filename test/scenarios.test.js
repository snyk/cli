var test = require('tape');
var fs = require('then-fs');
var scenario = require('../cli/commands/scenario');

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

    return res.map(function (res) {
      t.equal(JSON.stringify(res[0], '', 2), res[1]);
    });
  }).catch(function (e) {
    t.fail(e);
  }).then(function () {
    t.end();
  });

});