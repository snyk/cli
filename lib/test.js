module.exports = test;

var userConfig = require('./user-config');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('./request');
var fs = require('then-fs');
var snyk = require('..');

// important: this is different from ./config (which is the *user's* config)
var config = require('./config');

function test(root, callback) {
  var promise = fs.exists(root).then(function (exists) {
    // if the file exists, let's read the package file and post
    // that up to the server.
    // if it doesn't, then we're assuming this is an existing
    // module on npm, so send the bare argument
    var payload = {
      url: config.API + '/vuln',
      json: true,
      headers: {
        authorization: 'token ' + snyk.api,
      },
    };

    var p = Promise.resolve();
    if (exists) {
      p = snyk.modules(root,'unknown').then(function (pkg) {
        payload.method = 'POST';
        payload.body = pkg;
        return payload;
      });
    } else {
      p = p.then(function () {
        payload.method = 'GET';
        payload.url += '/' + root;
        return payload;
      });
    }

    return p.then(function (payload) {
      return new Promise(function (resolve, reject) {
        request(payload, function (error, res, body) {
          if (error) {
            return reject(error);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(body.error || res.statusCode));
          }

          resolve(body);
        });
      });
    });
  });

  if (callback) {
    promise.then(function (res) {
      callback(null, res);
    }).catch(callback);
  }

  return promise;
}
