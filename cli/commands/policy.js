module.exports = displayPolicy;

var policy = require('../../lib/policy');

function displayPolicy(path) {
  return policy.load(path || process.cwd()).then(policy.display);
}