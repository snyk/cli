module.exports = displayPolicy;

const policy = require('snyk-policy');
const display = require('../../lib/display-policy');
const errors = require('../../lib/errors');

function displayPolicy(path) {
  return policy.load(path || process.cwd())
    .then(display)
    .catch((e) => {
      let error;
      if (e.code === 'ENOENT') {
        error = new errors.PolicyNotFoundError();
      } else {
        error = new errors.FailedToLoadPolicyError();
        error.innerError = e;
      }
      throw error;
    });
}
