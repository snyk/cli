module.exports = dedupe;

var debug = require('debug')('snyk:patch');
var patchesForPackage = require('./patches-for-package');

function dedupe(source) {
  var removed = [];

  var names = source.reduce(function (acc, vuln) {
    if (Array.isArray(vuln.patches)) {
      // strip down to the only paches that can be applied
      vuln.patches = patchesForPackage(vuln);
    }

    var key = vuln.name + vuln.version + vuln.from.join('>');

    var other = acc[key];
    if (other) {
      debug('dupe found on %s & %s', vuln.id, other.id);
      if (vuln.publicationTime > other.publicationTime) {
        debug('stripping %s', other.id);
        removed.push(other);
        acc[key] = vuln;
      } else {
        removed.push(vuln);
      }
    } else {
      acc[key] = vuln;
    }

    return acc;
  }, {});

  // turn back into an array
  var packages = Object.keys(names).map(function (key) {
    return names[key];
  });

  return {
    packages: packages,
    removed: removed,
  };
}
