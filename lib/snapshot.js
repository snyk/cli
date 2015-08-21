module.exports = snapshot;
module.exports.capture = captureRequires;

var snyk = require('..');
var userConfig = require('./user-config');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var path = require('path');
var request = require('./request');
var config = require('./config');
var os = require('os');
var modules = [];

function snapshot(meta, modules) {
  return new Promise(function (resolve, reject) {
    request({
      body: {
        meta: {
          method: meta.method,
          hostname: os.hostname(),
          id: snyk.id,
          pid: process.pid,
          master: snyk.config.isMaster,
          name: modules.name,
          version: modules.version,
        },
        package: modules,
      },
      gzip: true,
      method: 'PUT',
      headers: {
        authorization: 'token ' + userConfig.get('api'),
        'content-encoding': 'gzip',
      },
      url: config.API + '/snapshot',
      json: true,
    }, function (error, res, body) {
      if (error) {
        return reject(error);
      }

      if (res.statusCode === 200 || res.statusCode === 201) {
        resolve(body);
      } else {
        reject(new Error('unknown failure: ' + res.statusCode));
      }
    });
  }).catch(function (error) {
    console.error('snyk snapshot failed');
    console.error(error.stack);
  });
}

function captureRequires() {
  var timer = null;
  snyk.bus.on('after:module', function (module) {
    clearTimeout(timer);
    modules.push(module);

    // full task (rather than microtask)
    timer = setTimeout(resolve, 100);
  });
}

function resolve() {
  // the snapshot should capture everything *excluding* snyk modules
  // and post up to the snyk registry for the user
  var paths = modules.map(function (module) {
    return module.id;
  });

  // work out the root directory of the project...
  var candidate = paths.reduce(function (acc, curr) {
    if (curr.indexOf('node_modules') === -1) {
      return acc;
    }

    var path = curr
      .split('node_modules')
      .slice(0, -1)
      .join('node_modules') + 'node_modules';

    if (acc.indexOf(path) === -1) {
      acc.push(path);
    }

    return acc;
  }, []).sort().shift();

  // then collect all the package deps and post a snapshot
  snyk.modules(path.resolve(candidate, '..')).then(snapshot.bind(null, {
    method: 'require',
  }));
}