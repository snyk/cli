module.exports = snapshot;

var snyk = require('../../lib/');

function snapshot(path) {
  if (!path) {
    path = process.cwd();
  }

  return snyk.modules(path || process.cwd())
    .then(snyk.snapshot.bind(null, { method: 'cli' }))
    .then(function () {
      return null;
    });
}
