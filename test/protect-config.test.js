var protect = require('../lib/protect');
var test = require('tape');
var plan = require('./fixtures/protect-interactive.json');

test('protect generates config', function (t) {
  var config = {};
  protect.generateConfig(config, plan, false).then(function (config) {
    console.log(JSON.stringify(config));
    t.end();
  }).catch(function (e) {
    console.log(e.stack);
    t.fail(e.message);
  });
});