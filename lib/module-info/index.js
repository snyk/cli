var detectFile = require('../detect').detectPackageFile;

module.exports = function getModuleInfo(packageManager, root, options) {
  var targetFile = options.file || detectFile(root);
  var getInfo = loadModuleInfoForPackageManager(packageManager);
  return getInfo(root, targetFile, options.policy);
};

function loadModuleInfoForPackageManager(packageManager) {
  switch (packageManager) {
    case 'npm': {
      return require('./npm');
    }
    case 'rubygems': {
      return require('./rubygems');
    }
    case 'maven': {
      return require('./maven');
    }
    default: {
      throw new Error('Unsupported package manager: ' + packageManager);
    }
  }
}
