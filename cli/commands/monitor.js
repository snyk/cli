module.exports = monitor;

var snyk = require('../../lib/');

function monitor(path) {
  if (!path) {
    path = process.cwd();
  }

  return snyk.modules(path || process.cwd())
    .then(snyk.monitor.bind(null, { method: 'cli' }))
    .then(function () {
      return null;
    });
}
