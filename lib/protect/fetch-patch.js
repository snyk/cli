module.exports = getPatchFile;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var needle = require('needle');
var fs = require('then-fs');
var analytics = require('../analytics');
var debug = require('debug')('snyk:fetch-patch');
var getProxyForUrl = require('proxy-from-env').getProxyForUrl;

function getPatchFile(url, filename, attempts) {
  return new Promise(function (resolve, reject) {
    var options = {};
    var proxy = getProxyForUrl(url);
    if (proxy) {
      debug('Using proxy: ', proxy);
      options.proxy = proxy;
    }

    needle.get(url, options)
      .on('response', function (response) {
        if (response.statusCode >= 400) {
          if (!attempts) {
            var err = new Error('Failed to fetch patch file');
            analytics.add('patch-fetch-fail', {
              message: err.message,
              code: response.statusCode,
            });
            return reject(err);
          }
          return resolve(getPatchFile(url, filename, attempts - 1));
        }
      })
      .on('done', function () {
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
