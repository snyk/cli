module.exports = writePatchFlag;

var debug = require('debug')('snyk');
var fs = require('then-fs');
var path = require('path');
var Promise = require ('es6-promise').Promise; // jshint ignore:line

function writePatchFlag(now, vuln) {
  if (!vuln) {
    vuln = now;
    now = new Date();
  }

  debug('writing flag for %s', vuln.id);
  var promise;
  var flag = path.resolve(vuln.source, '.snyk-' + vuln.id + '.flag');
  if (vuln.grouped && vuln.grouped.includes) {
    debug('found addition vulns to write flag files for');
    var writePromises = [fs.writeFile(flag, now.toJSON(), 'utf8')];
    debug(flag);
    vuln.grouped.includes.forEach(function (id) {
      var flag = path.resolve(vuln.source, '.snyk-' + id + '.flag');
      debug(flag);
      writePromises.push(fs.writeFile(flag, now.toJSON(), 'utf8'));
    });
    promise = Promise.all(writePromises);
  } else {
    promise = fs.writeFile(flag, now.toJSON(), 'utf8');
  }

  return promise.then(function () {
    return vuln;
  });
}