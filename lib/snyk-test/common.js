
module.exports.assembleQueryString = function (options) {
  qs = {};
  if (options.org) {
    qs.org = options.org;
  }
  if (options.severityThreshold) {
    qs.severityThreshold = options.severityThreshold;
  }

  return Object.keys(qs).length !== 0 ? qs : null;
}

module.exports.SEVERITIES = ['low', 'medium', 'high'];
