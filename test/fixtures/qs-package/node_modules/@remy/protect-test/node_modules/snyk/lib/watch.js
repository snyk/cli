module.exports = watch;

var debug = require('debug')('snyk');
var request = require('request');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var config = require('./config');
var userConfig = require('./user-config');
var resolve = require('./resolve');
var snyk = require('../');

function watch(module) {
  var payload = {
    url: config.API + '/watch/',
    json: true,
    method: 'POST',
  };

  debug(module, typeof module);

  return resolve(module).then(function (module) {
    if (typeof module === 'string') {
      debug('module: %s', module);
      payload.url += module;
    } else {
      payload.body = module;
    }

    // register watch
    debug('authorization: token %s', snyk.api);
    return new Promise(function (resolve, reject) {
      payload.headers = {
        authorization: 'token ' + snyk.api,
      };
      debug('payload', payload);
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
}