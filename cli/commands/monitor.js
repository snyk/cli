module.exports = monitor;

var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');

function monitor(path) {
  if (!path) {
    path = process.cwd();
  }

  return snyk.modules(path || process.cwd())
    .then(snyk.monitor.bind(null, { method: 'cli' }))
    .then(function (res) {
      var endpoint = url.parse(config.API);
      endpoint.pathname = '/monitor/' + res.id;
      return 'Local state captured: ' + url.format(endpoint);
    });
}
