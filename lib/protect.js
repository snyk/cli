module.exports = {
  ignore: ignore,
  update: update,
  patch: patch,
};

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var snyk = require('./');
var npm = require('npm');

function ignore(vulns) {
  return new Promise(function (resolve) {
    var config = {};
    config.ignore = vulns.map(function (vuln) {
      return vuln.from.slice(1);
    });

    // FIXME should merge, not oblitorate
    resolve(snyk.dotfile.save(config));
  });
}

function update(packages, live) {
  return new Promise(function (resolve, reject) {
    npm.load({
      save: true, // save to the user's local package.json
    }, function (error, npm) {
      if (error) {
        return reject(error);
      }

      debug('to upgrade', packages);

      // the uninstall doesn't need versions in the strings
      // but install *does* so we build up arrays of both
      var upgradeWithoutVersions = [];
      var upgrade = packages.map(function (res) {
        upgradeWithoutVersions.push(res.package);
        return res.package + '@' + res.version;
      });

      var promises = [
        npmit('uninstall', npm, upgradeWithoutVersions, live),
        npmit('install', npm, upgrade, live),
      ];

      resolve(Promise.all(promises));
    });
  });

}

function npmit(method, npm, packages, live) {
  return new Promise(function (resolve, reject) {
    debug('npm ' + method + ' %s', packages.join(' '));
    if (!live) {
      debug('[skipping - dry run]');
      return resolve();
    }
    npm.commands[method](packages, function (error) {
      if (error) {
        return reject(error);
      }
      resolve();
    });
  });
}

function patch() {
  return Promise.resolve('noop');

  // debug('patching', toPatch);

  // var patches = toPatch.map(function (package) {
  //   return Promise.resolve(package);
  // });

  // // merge the promises
  // [].push.apply(promises, patches);
}