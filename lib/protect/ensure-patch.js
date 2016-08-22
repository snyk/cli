module.exports = ensurePatchExists;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var hasbin = require('hasbin');
var analytics = require('../analytics');

function ensurePatchExists() {
  return new Promise(function (resolve, reject) {
    return hasbin('patch', function (exists) {
      if (!exists) {
        var err = new Error('Snyk couldn\'t patch the specified ' +
                            'vulnerabilities because GNU\'s patch is not ' +
                            'available. Please install \'patch\' ' +
                            'and try again.');
        analytics.add('patch-binary-missing', {
          message: err.message,
        });
        return reject(err);
      }
      return resolve();
    });
  });
}
