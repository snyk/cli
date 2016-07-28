module.exports = count;

var walk = require('../lib/walk');
var semver = require('semver');
var toObject = require('snyk-module');

function count(options, res) {
  var match = toObject(options.count);
  var total = [];

  walk(res, function (dep) {
    if (dep.name === match.name) {
      if (semver.satisfies(dep.version, match.version)) {
        total.push(dep);
      }
    }
  });
  console.log('%s %s@%s', total.length, match.name, match.version);
  total.forEach(function (dep) {
    console.log(' - %s (%s) - %s', dep.full, dep.depType,
      (dep.from || []).join(' > '));
  });
}
