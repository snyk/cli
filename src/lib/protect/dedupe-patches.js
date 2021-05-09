module.exports = dedupe;

const util = require('util');
const debug = util.debuglog('snyk:patch');
const patchesForPackage = require('./patches-for-package');

function dedupe(source) {
  const removed = [];

  const names = source.reduce((acc, vuln) => {
    if (Array.isArray(vuln.patches)) {
      // strip down to the only paches that can be applied
      vuln.patches = patchesForPackage(vuln);
    }

    const key = vuln.name + vuln.version + vuln.from.join('>');

    const other = acc[key];
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
  const packages = Object.keys(names).map((key) => {
    return names[key];
  });

  return {
    packages: packages,
    removed: removed,
  };
}
