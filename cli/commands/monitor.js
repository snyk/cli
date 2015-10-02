module.exports = monitor;

var fs = require('then-fs');
var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');

function monitor(path) {
  if (!path) {
    path = process.cwd();
  }

  return fs.exists(path).then(function (exists) {
    if (!exists) {
      throw new Error('snyk monitor should be pointed at an existing project');
    }

    return snyk.modules(path)
      .then(snyk.monitor.bind(null, { method: 'cli' }))
      .then(function (res) {
        var endpoint = url.parse(config.API);
        endpoint.pathname = '/monitor/' + res.id;
        return 'Local state captured: ' + url.format(endpoint);
      });

  });

}
