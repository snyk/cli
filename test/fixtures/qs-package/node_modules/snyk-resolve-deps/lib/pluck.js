module.exports = pluck;

var semver = require('semver');
var moduleToObject = require('snyk-module');
var debug = require('debug')('snyk:resolve:pluck');
var parseOptions = { loose: true };

function pluck(root, path, name, range) {
  if (range === 'latest') {
    range = '*';
  }

  // Cycle through the tree path via the root tree object **ala node require**.
  // note that we don't need the first item in the path (which is the root
  // package name).
  var from = path.slice(0);
  var rootPath = moduleToObject(from.shift(), parseOptions).name;

  // if the root of the virtual tree doesn't even match our path, bail out
  if (rootPath !== root.name) {
    return false;
  }

  // do a check to see if the last item in the path is actually the package
  // we're looking for, and if it's not, push it on
  if (from.length !== 0 &&
      moduleToObject(from.slice(-1).pop(), parseOptions).name === name) {
    from.pop();
  }

  // then we always put the target package on the end of the chain
  // to ensure it's in exactly the right format to be used in `getMatch`
  from.push(name + '@' + range);

  debug('using forward search %s@%s in %s', from.join(' > '));

  var match = false;
  var leaf = root;
  var realPath = [];

  while (from.length) {
    var pkg = moduleToObject(from[0], parseOptions);
    var test = getMatch(leaf, pkg.name, pkg.version);

    if (test) {
      from.shift();
      realPath.push(leaf);
      leaf = test;
    } else {
      leaf = realPath.pop();
      if (!leaf) {
        return false;
      }
    }
  }

  return leaf.name === name ? leaf : false;
}

function getMatch(root, name, range) {
  var dep = root.dependencies && root.dependencies[name];
  if (!dep) {
    return false;
  }

  var version = dep.version;
  debug('pluck match on name...checking version: %s ~= %s', version, range);
  // make sure it matches our range
  var semverMatch = semver.validRange(range) &&
    semver.valid(version) &&
    semver.satisfies(version, range);

  var externalPackage = !semver.validRange(range) &&
    range.indexOf(':/') !== -1;

  if (semverMatch || externalPackage) {
    debug('pluck match');
    if (!dep.dep) {
      dep.dep = range;
    }
    return dep;
  }

  return false;
}