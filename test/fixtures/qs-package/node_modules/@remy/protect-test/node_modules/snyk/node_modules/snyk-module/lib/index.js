module.exports = moduleToObject;
module.exports.encode = encode;

var debug = require('debug')('snyk:module');

function moduleToObject(str) {
  var parts = str.split('@');
  if (str.indexOf('@') === 0) {
    // put the scoped package name back together
    parts = parts.slice(1);
    parts[0] = '@' + parts[0];
  }

  if (parts.length === 1) { // no version
    parts.push('*');
  }

  var module = {
    name: parts[0],
    version: parts[1],
  };

  return supported(module);
}

function encode(name) {
  return name[0] + encodeURIComponent(name.slice(1));
}

function supported(module) {
  var error;
  // if (module.name.indexOf('@') === 0) {
  //   debug('not supported %s@%s (private)', module.name, module.version);
  //   error = new Error('not supported: private module ' + toString(module));
  // }

  if (module.version.indexOf('http') === 0 ||
      module.version.indexOf('git') === 0) {
    // we don't support non-npm modules atm
    debug('not supported %s@%s (ext)', module.name, module.version);
    error = new Error('not supported: external module: ' + toString(module));
  }

  if (error) {
    error.code = 501; // not implemented
    throw error;
  }

  return module;
}

function toString(module) {
  return module.name + '@' + module.version;
}