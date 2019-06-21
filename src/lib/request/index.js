var request = require('./request');
var alerts = require('../alerts');

module.exports = function (payload, callback) {
  return request(payload)
    .then((result) => {
      if (result.body.alerts) {
        alerts.registerAlerts(result.body.alerts);
      }
      // make callbacks and promises work
      if (callback) {
        callback(null, result.res, result.body);
      }
      return result;
    })
    .catch((error) => {
      if (callback) {
        return callback(error);
      }
      throw error;
    });
};
