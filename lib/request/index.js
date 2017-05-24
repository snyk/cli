var request = require('./request');
var alerts = require('../alerts');

module.exports = function (payload, callback) {
  return request(payload)
  .then(function (result) {
    if (result.body.alerts) {
      alerts.registerAlerts(result.body.alerts);
    }
    // make callbacks and promises work
    if (callback) {
      callback(null, result.res, result.body);
    }
    return result;
  })
  .catch(function (error) {
    if (callback) {
      callback(error);
    }
    throw error;
  });
};
