module.exports = displayPolicy;

var policy = require('../../lib/policy');

function displayPolicy(path) {
  return policy.load(path || process.cwd())
    .then(policy.display)
    .catch(function (e) {
      if (e.code === 'ENOENT') {
        e.code = 'MISSING_DOTFILE';
      }
      throw e;
    });
}