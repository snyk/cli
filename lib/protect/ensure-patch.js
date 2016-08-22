module.exports = ensurePatchExists;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var hasbin = require('hasbin');
var analytics = require('../analytics');

function ensurePatchExists() {
  return new Promise(function (resolve, reject) {
    return hasbin('patch', function (exists) {
      if (!exists) {
        var err = new Error('GNU "patch" binary does not exist.');
        analytics.add('patch-binary-missing', {
          message: err.message,
        });
        return reject(err);
      }
      return resolve();
    });
  });
}
