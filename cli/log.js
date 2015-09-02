var log = require('npmlog');

module.exports = function (level) {
  log.level = level;

  [
    'silly',
    'verbose',
    'info',
    'http',
    'warn',
    'error',
  ].forEach(function (level) {
    log[level] = log[level].bind(log, 'snyk');
  });

  return log;
};