module.exports = {
  loadPlugin: loadPlugin,
};

function loadPlugin(packageManager) {
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
    case 'gradle': {
      return require('./gradle');
    }
    case 'yarn': {
      return require('./yarn');
    }
    case 'pip': {
      return require('snyk-python-plugin');
    }
    default: {
      throw new Error('Unsupported package manager: ' + packageManager);
    }
  }
}
