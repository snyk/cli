var protect = require('../src/lib/protect');
var test = require('tap').test;
var plan = require('./fixtures/protect-interactive.json');
var expected = require('./fixtures/protect-interactive-config.json');

test('protect generates config', function(t) {
  var config = {};
  t.plan(1);
  protect
    .generatePolicy(config, plan, false)
    .then(function(config) {
      // copy the expires from the config to our expected object
      Object.keys(config.ignore).forEach(function(id) {
        // each vuln id
        config.ignore[id].forEach(function(path, i) {
          if (typeof path !== 'string') {
            path = Object.keys(path).pop();
            expected.ignore[id][i][path].expires =
              config.ignore[id][i][path].expires;
          }
        });
      });
      t.deepEqual(expected, config, 'config is as expected');
    })
    .catch(function(e) {
      console.log(e.stack);
      t.fail(e.message);
    });
});
