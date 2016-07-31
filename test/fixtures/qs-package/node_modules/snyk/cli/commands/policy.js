module.exports = displayPolicy;

var policy = require('snyk-policy');
var display = require('../../lib/display-policy');

function displayPolicy(path) {
  return policy.load(path || process.cwd())
    .then(display)
    .catch(function (e) {
      if (e.code === 'ENOENT') {
        e.code = 'MISSING_DOTFILE';
      }
      throw e;
    });
}