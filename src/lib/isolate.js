module.exports = isolate;
module.exports.okay = okay;

const snyk = require('..');
const semver = require('semver');
const fs = require('fs');

const modules = {};
let potentialBlacklist = {};

function isolate(options) {
  if (!options) {
    options = {};
  }

  if (Array.isArray(options.isolate)) {
    potentialBlacklist = options.isolate.map((pkg) => {
      const i = pkg.lastIndexOf('@');
      return {
        name: pkg.slice(0, i),
        version: pkg.slice(i + 1),
      };
    }).reduce((acc, curr) => {
      acc[curr.name] = curr;
      return acc;
    }, {});
  }

  snyk.bus.on('after:module', (module) => {
    instrumentProps(module.id, module.id, module.exports);
  });
}



function instrumentProps(id, key, obj) {
  // only apply once
  if (obj.__snyked) {
    return obj;
  }

  obj.__snyked = true;
  const type = typeof obj;
  const original = obj;

  if (type === 'function') {
    obj = function instrumented() {
      console.log('NOTIFY: %s@%s', key || id, id);
      original.apply(this, arguments);
    };
  }

  if (type === 'object' || type === 'function') {
    Object.keys(original).forEach((key) => {
      const prop = original[key];
      if (key === '__snyked') {
        return;
      }
      obj[key] = instrumentProps(id, key, prop);
    });
  }

  console.log('instrumented %s@%s', key, id.split('/').pop());

  return obj;
}

function okay(filename) {
  return !checkIsolation(filename);
}

function checkIsolation(filename) {
  const parts = filename.split('node_modules/');
  const module = parts.slice(-1)[0].split('/')[0];
  if (!modules[module] && module) {
    modules[module] = true;

    const check = potentialBlacklist[module];

    if (check) {
      const pkgFilename = filename.split(module)[0];
      const pkg = fs.readFileSync(pkgFilename + module + '/package.json');
      let version;
      try {
        version = JSON.parse(pkg).version;
      } catch (e) {}
      if (version) {
        if (semver.satisfies(version, check.version)) {
          throw new Error('Snyk: Isolated module "' + check.name +
            '@' + check.version + '" was not allowed to load');
        }
      }
    }

  }

  // lookup the version

  return false;
}
