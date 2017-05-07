module.exports = monitor;

var fs = require('then-fs');
var apiTokenExists = require('../../lib/api-token').exists;
var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');
var chalk = require('chalk');

var detect = require('../../lib/detect');
var plugins = require('../../lib/plugins');
var ModuleInfo = require('../../lib/module-info');

function monitor(path, options) {
  if (typeof path === 'object') {
    options = path;
    path = process.cwd();
  }

  if (!path) {
    path = process.cwd();
  }

  if (!options) {
    options = {};
  }

  if (options.id) {
    snyk.id = options.id;
  }

  return apiTokenExists('snyk monitor').then(function () {
    return fs.exists(path);
  }).then(function (exists) {
    if (!exists) {
      throw new Error('snyk monitor should be pointed at an existing project');
    }
    var packageManager = detect.detectPackageManager(path, options);
    var targetFile = options.file || detect.detectPackageFile(path);
    var meta = { method: 'cli', packageManager: packageManager };
    var plugin = plugins.loadPlugin(packageManager);
    var moduleInfo = ModuleInfo(plugin, options.policy);
    return moduleInfo.inspect(path, targetFile, options._doubleDashArgs)
      .then(snyk.monitor.bind(null, path, meta))
      .then(function (res) {
        var endpoint = url.parse(config.API);
        var leader = '';
        if (res.org) {
          leader = '/org/' + res.org;
        }
        endpoint.pathname = leader + '/manage';
        var manageUrl = url.format(endpoint);

        endpoint.pathname = leader + '/monitor/' + res.id;
        var issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
        return (packageManager === 'yarn' ?
        'A yarn.lock file was detected - continuing as a Yarn project.\n\n' :
        '\n\n') +
        'Captured a snapshot of this project\'s dependencies.\n' +
        'Explore this snapshot at ' +  res.uri + '\n\n' +
        (res.isMonitored ?
         'Notifications about newly disclosed ' + issues + ' related\n' +
         'to these dependencies will be emailed to you.\n\n' :
         chalk.bold.red('Project is inactive, so notifications are turned ' +
        'off.\nActivate this project here: ' + manageUrl + '\n\n')) +
        (res.trialStarted ?
        chalk.yellow('You\'re over the free plan usage limit, \n' +
        'and are now on a free 14-day premium trial.\n' +
        'View plans here: ' + manageUrl + '\n\n') :
        '');
      });
  });
}
