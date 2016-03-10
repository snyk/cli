module.exports = captureRequires;

var path = require('path');
var modules = [];
var snyk = require('..');

function captureRequires() {
  var timer = null;
  snyk.bus.on('after:module', function (module) {
    clearTimeout(timer);
    modules.push(module);

    // full task (rather than microtask)
    timer = setTimeout(resolve, 100);
  });
}

function resolve() {
  // the monitor should capture everything *excluding* snyk modules
  // and post up to the snyk registry for the user
  var paths = modules.map(function (module) {
    return module.id;
  });

  // work out the root directory of the project...
  var candidate = paths.reduce(function (acc, curr) {
    if (curr.indexOf('node_modules') === -1) {
      return acc;
    }

    var path = curr
      .split('node_modules')
      .slice(0, -1)
      .join('node_modules') + 'node_modules';

    if (acc.indexOf(path) === -1) {
      acc.push(path);
    }

    return acc;
  }, []).sort().shift();

  // then collect all the package deps and post a monitor
  var cwd = path.resolve(candidate, '..');
  snyk.modules(cwd).then(snyk.monitor.bind(null, cwd, {
    method: 'require',
  }));
}