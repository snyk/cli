module.exports = ensurePatchExists;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var hasbin = require('hasbin');

function ensurePatchExists() {
  return new Promise(function (resolve, reject) {
    return hasbin('patch', function (exists) {
      return exists ? resolve() : reject(
        new Error('Binary "patch" does not exist.')
      );
    });
  });
}
