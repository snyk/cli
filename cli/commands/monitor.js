module.exports = monitor;

var _ = require('lodash');
var fs = require('then-fs');
var apiTokenExists = require('../../lib/api-token').exists;
var snyk = require('../../lib/');
var config = require('../../lib/config');
var url = require('url');
var chalk = require('chalk');
var spinner = require('../../lib/spinner');

var detect = require('../../lib/detect');
var plugins = require('../../lib/plugins');
var ModuleInfo = require('../../lib/module-info');

function monitor() {
  var args = [].slice.call(arguments, 0);
  var options = {};
  var results = [];
  if (typeof args[args.length - 1] === 'object') {
    options = args.pop();
  }

  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length ===  0) {
    args.unshift(process.cwd());
  }

  if (options.id) {
    snyk.id = options.id;
  }

  var lbl = 'Running monitor...';

  return spinner(lbl).then(function () {
    return apiTokenExists('snyk monitor');
  })
  .then(function () {
    return args.reduce(function (acc, path) {
      return acc.then(function () {
        return fs.exists(path).then(function (exists) {
          if (!exists) {
            throw new Error(
              'snyk monitor should be pointed at an existing project');
          }
          var packageManager = detect.detectPackageManager(path, options);
          var targetFile = options.file || detect.detectPackageFile(path);
          var meta = {
            method: 'cli',
            packageManager: packageManager,
            'policy-path': options['policy-path'],
            'project-name': options['project-name'] || config['PROJECT_NAME'],
          };
          var plugin = plugins.loadPlugin(packageManager);
          var moduleInfo = ModuleInfo(plugin, options.policy);
          return moduleInfo.inspect(path, targetFile, options)
            .then(snyk.monitor.bind(null, path, meta))
            .then(function (res) {
              res.path = path;
              var endpoint = url.parse(config.API);
              var leader = '';
              if (res.org) {
                leader = '/org/' + res.org;
              }
              endpoint.pathname = leader + '/manage';
              var manageUrl = url.format(endpoint);

              endpoint.pathname = leader + '/monitor/' + res.id;
              var output = formatMonitorOutput(
                packageManager, res,
                manageUrl, options.json
              );
              // push a good result
              results.push({ok: true, data: output, path: path});
            });
        }).catch(function (err) {
          // push this error so the promise chain continues
          results.push({ok: false, data: err, path: path});
        });
      });
    }, Promise.resolve())
    .then(function () {
      if (options.json) {
        var dataToSend = results.map(function (result) {
          if (result.ok) {
            return JSON.parse(result.data)
          }
          return {ok: false, error: result.data.message, path: result.path}
        });
        // backwards compat - strip array if only one result
        dataToSend = dataToSend.length === 1 ? dataToSend[0] : dataToSend;
        var json = JSON.stringify(dataToSend, null, 2);

        if (results.every(function (res) { return res.ok; })) {
          return json
        }

        throw new Error(json);
      }

      return results.map(function (res) {
        if (res.ok) {
          return res.data;
        }
        return 'For path `' + res.path + '`, ' + res.data.message;
      }).join('\n');
    });
  }).then(spinner.clear(lbl));
}

function formatMonitorOutput(packageManager, res, manageUrl, isJson) {
  var issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  var strOutput = (packageManager === 'yarn' ?
    'A yarn.lock file was detected - continuing as a Yarn project.\n\n' : '') +
    '\n\nProject path: ' + res.path +
    '\nCaptured a snapshot of this project\'s dependencies.\n' +
    'Explore this snapshot at ' + res.uri + '\n\n' +
    (res.isMonitored ?
      'Notifications about newly disclosed ' + issues + ' related\n' +
      'to these dependencies will be emailed to you.' :
      chalk.bold.red('Project is inactive, so notifications are turned ' +
        'off.\nActivate this project here: ' + manageUrl + '\n\n')) +
    (res.trialStarted ?
      chalk.yellow('You\'re over the free plan usage limit, \n' +
        'and are now on a free 14-day premium trial.\n' +
        'View plans here: ' + manageUrl + '\n\n') :
      '');

  return isJson ?
    JSON.stringify(_.assign({}, res, {
      manageUrl: manageUrl,
      packageManager: packageManager,
    })) : strOutput;
}