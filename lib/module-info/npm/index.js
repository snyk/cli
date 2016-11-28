var snyk = require('../../');

module.exports = function getModuleInfo(root) {
  return snyk.modules(root);
};
