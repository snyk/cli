module.exports = resolvePkg;
module.exports.sync = sync;

var fs = require('then-fs');
var path = require('path');
var debug = require('debug')('snyk:resolve');

function resolvePkg(name, basedir) {
  if (!basedir) {
    basedir = process.cwd();
  }

  var filename = path.resolve(basedir, 'node_modules', name, 'package.json');
  debug('%s: %s', name, filename);
  return fs.stat(filename).then(function (stat) {
    if (stat.isFile()) {
      return path.dirname(filename);
    }
  }).catch(function (error) {
    debug('%s: not found on %s (root? %s)', name, basedir, isRoot(basedir));
    if (isRoot(basedir)) {
      debug('at root');
      error = new Error('package not found ' + name);
      error.code = 'NO_PACKAGE_FOUND';
      throw error;
    }
  }).then(function (dir) {
    if (dir) {
      debug('%s: FOUND AT %s', name, dir);
      return dir;
    }

    debug('%s: cycling down', name);
    return resolvePkg(name, path.resolve(basedir, '..'));
  });
}

function sync(name, basedir) {
  if (!basedir) {
    basedir = process.cwd();
  }

  var filename = path.resolve(basedir, 'node_modules', name, 'package.json');
  debug('%s: %s', name, filename);

  var isFile = function (file) {
    var stat;
    try {
      stat = fs.statSync(file);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return false;
      }
    }
    return stat.isFile() || stat.isFIFO();
  };

  if (isFile(filename)) {
    debug('%s: FOUND AT %s', name, filename);
    return path.dirname(filename);
  }

  if (isRoot(basedir)) {
    debug('%s: not found on %s (now at root)', name, filename);
    var error = new Error('package not found ' + name);
    error.code = 'NO_PACKAGE_FOUND';
    throw error;
  }

  debug('%s: cycling down', name);
  return sync(name, path.resolve(basedir, '..'));
}

function isRoot(dir) {
  var parsed = parse(dir);
  return parsed.root === parsed.dir && !parsed.base;
}

// FIXME determine whether this would work properly on windows in 0.10
function parse(dir) {
  /* istanbul ignore else  */
  // jscs:disable requireEarlyReturn
  if (path.parse) {
    return path.parse(dir);
  } else {
    var split = dir.split(path.sep);
    var root = split[0] + path.sep;
    return {
      base: split[1],
      root: root,
      dir: dir,
    };
  }
  // jscs:enable requireEarlyReturn
}
