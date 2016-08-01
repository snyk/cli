module.exports = monitor;

var fs = require('then-fs');
var apiTokenExists = require('../../lib/api-token').exists;
var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');
var chalk = require('chalk');

function monitor(path, options) {
  if (!path) {
    path = process.cwd();
  }

  if (!options) {
    options = {};
  }

  return apiTokenExists('snyk monitor').then(function () {
    return fs.exists(path);
  }).then(function (exists) {
    if (!exists) {
      throw new Error('snyk monitor should be pointed at an existing project');
    }

    if (options.id) {
      snyk.id = options.id;
    }

    return snyk.modules(path)
      .then(snyk.monitor.bind(null, path, { method: 'cli' }))
      .then(function (res) {
        var endpoint = url.parse(config.API);
        var leader = '';
        if (res.org) {
          leader = '/org/' + res.org;
        }
        endpoint.pathname = leader + '/monitor/' + res.id;
        var monitorUrl = url.format(endpoint);
        endpoint.pathname = leader + '/manage';
        var manageUrl = url.format(endpoint);

        endpoint.pathname = leader + '/monitor/' + res.id;
        return 'Captured a snapshot of this project\'s dependencies.\n' +
        'Explore this snapshot at ' +  monitorUrl + '\n\n' +
        (res.isMonitored ?
        'Notifications about newly disclosed vulnerabilities\n' +
        'related to these dependencies will be emailed to you.\n\n' :
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
