
module.exports.assembleQueryString = function (options) {
  var qs = {};
  if (options.org) {
    qs.org = options.org;
  }
  if (options.severityThreshold) {
    qs.severityThreshold = options.severityThreshold;
  }

  return Object.keys(qs).length !== 0 ? qs : null;
};

module.exports.SEVERITIES = [
  {
    verboseName: 'low',
    value: 1,
  },
  {
    verboseName: 'medium',
    value: 2,
  },
  {
    verboseName: 'high',
    value: 3,
  },
];
module.exports.WIZARD_SUPPORTED_PMS = ['npm', 'yarn'];
