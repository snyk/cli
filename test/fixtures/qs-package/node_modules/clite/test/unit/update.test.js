'use strict';
var dist = require('./es5') ? 'dist' : 'lib';
var test = require('tap-only');
var proxyquire = require('proxyquire');

test('update notifier', function (t) {
  delete process.env['npm_config_node_version']; // jshint ignore:line
  var update = proxyquire('../../' + dist + '/update', {
    'update-notifier': function updateNotifier(opts) {
      t.equal(opts.pkg.version, '1.2.3', 'update received correct version');
      return {
        notify: function notify() {}
      };
    }
  });

  update(__dirname + '/../fixtures/basic-clite');
  t.end();
});