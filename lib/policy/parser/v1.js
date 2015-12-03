// eventually we'll have v2 which will point to latestParser, and v1 will
// need to process the old form of data and upgrade it to v2 structure
module.exports = function (policy) {
  if (!policy.ignore) {
    policy.ignore = {};
  }

  if (!policy.patch) {
    policy.patch = {};
  }

  return policy;
};