const config = require('../config');

module.exports.assembleQueryString = function (options) {
  const org = options.org || config.org || null;
  const qs = {
    org,
  };

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
