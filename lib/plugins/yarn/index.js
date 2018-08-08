var snyk = require('../../');

module.exports = {
  inspect: inspect,
};

function inspect(root, targetFile, options) {
  return snyk.modules(root, Object.assign({}, options, {noFromArrays: true}))
    .then(function (modules) {
      return {
        plugin: {
          name: 'snyk-resolve-deps',
          runtime: process.version,
        },
        package: modules,
      };
    });
}
