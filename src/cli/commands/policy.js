module.exports = displayPolicy;

const policy = require('snyk-policy');
const display = require('../../lib/display-policy');

function displayPolicy(path) {
  return policy.load(path || process.cwd())
    .then(display)
    .catch((e) => {
      if (e.code === 'ENOENT') {
        e.code = 'MISSING_DOTFILE';
      }
      throw e;
    });
}
