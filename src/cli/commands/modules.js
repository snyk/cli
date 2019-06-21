var snyk = require('../../lib');

module.exports = function (path, options) {
  if (!options) {
    options = {};
  }
  return snyk.modules(path || process.cwd()).then((modules) => {

    var parent = '';
    if (modules.parent) {
      parent = modules.parent.full;
    }

    if (options.json) {
      return JSON.stringify(modules, '', 2);
    }

    return parent + Object.keys(modules.dependencies)
      .map((key) => modules.dependencies[key].full)
      .join('\n');
  });
};
