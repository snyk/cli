module.exports = getPatchFile;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('request');
var fs = require('then-fs');
var analytics = require('../analytics');

function getPatchFile(url, filename, attempts) {
  return new Promise(function (resolve, reject) {
    request(url)
      .on('end', function () {
        resolve(filename);
      })
      .on('error', function (err) {
        if (!attempts) {
          analytics.add('patch-fetch-fail', {
            message: err.message,
            code: err.code,
          });
          return reject(err);
        }
        resolve(getPatchFile(url, filename, attempts - 1));
      })
      .pipe(fs.createWriteStream(filename));
  });
}