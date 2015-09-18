module.exports = test;

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
      p = snyk.modules(root).then(function (pkg) {
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
    }).then(function (res) {
      return snyk.dotfile.load(root).then(function (config) {
        if (!config.ignore || res.ok) {
          return res;
        }

        // strip the ignored modules from the results
        res.vulnerabilities = res.vulnerabilities.map(function (vuln) {
          var ignored = config.ignore.filter(function (ignore) {
            return ignore.join('^') === vuln.from.slice(1).join('^');
          });

          if (ignored.length) {
            return false;
          }

          return vuln;
        }).filter(Boolean);

        return res;
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
