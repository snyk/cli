module.exports = getVulnSource;

const util = require('util');
const debug = util.debuglog('snyk');
const resolve = require('snyk-resolve');
const path = require('path');
const statSync = require('fs').statSync;
const { parsePackageString: moduleToObject } = require('snyk-module');

function getVulnSource(vuln, live) {
  const from = vuln.from.slice(1).map((pkg) => {
    return moduleToObject(pkg).name;
  });

  const viaPath = path.resolve(
    process.cwd(),
    'node_modules',
    from.join('/node_modules/'),
  );

  let source = vuln.__filename ? path.dirname(vuln.__filename) : viaPath;

  // try to stat the directory, if it throws, it doesn't exist...
  try {
    statSync(source);
  } catch (e) {
    // ...which means the package is located in a parent path (from an
    // npm dedupe process), so we remove the module name from the path
    // and use the `resolve` package to navigate the node_modules up
    // through parent directories.
    try {
      source = resolve.sync(from.slice(-1).pop(), viaPath);
    } catch (e) {
      let adaptedError = e;
      if (e.code === 'NO_PACKAGE_FOUND') {
        adaptedError =
          'Error: `' +
          e.message +
          "`\nWe can't patch without " +
          'dependencies installed. Please run `npm ' +
          'install` or  `yarn install` first.';
      }
      if (live) {
        throw adaptedError;
      }

      // otherwise this is a dry run so we don't mind that it won't be
      // able to patch - likely a scenario run, so it's fine that the
      // patch target won't be found
    }
    debug('found better source for package: %s', source);
  }

  return source;
}
