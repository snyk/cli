var path = require('path');
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function () {
  return new Promise(function (resolve) {
    var filename = path.resolve(__dirname, '..', '..', 'package.json');
    resolve(require(filename).version || 'development');
  });
};