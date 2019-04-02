module.exports = monitor;

import * as _ from 'lodash';
import * as fs from 'then-fs';
import {exists as apiTokenExists} from '../../lib/api-token';
import snyk = require('../../lib/'); // TODO(kyegupov): fix import
import * as config from '../../lib/config';
import * as url from 'url';
import chalk from 'chalk';
import * as pathUtil from 'path';
import * as spinner from '../../lib/spinner';

import * as detect from '../../lib/detect';
import * as plugins from '../../lib/plugins';
import ModuleInfo = require('../../lib/module-info'); // TODO(kyegupov): fix import
import * as docker from '../../lib/docker-promotion';
import { MonitorError } from '../../lib/monitor';
const SEPARATOR = '\n-------------------------------------------------------\n';

interface MonitorOptions {
  id?: string;
  docker?: boolean;
  file?: string;
  policy?: string;
  json?: boolean;
  'all-sub-projects'?: boolean;
}

interface GoodResult {
  ok: true;
  data: string;
  path: string;
}

interface BadResult {
  ok: false;
  data: MonitorError;
  path: string;
}

function monitor(...args0: any[]) {
  let args = [...args0];
  let options: MonitorOptions = {};
  const results: Array<GoodResult | BadResult> = [];
  if (typeof args[args.length - 1] === 'object') {
    options = args.pop() as any as MonitorOptions;
  }

  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length ===  0) {
    args.unshift(process.cwd());
  }

  if (options.id) {
    snyk.id = options.id;
  }

  // This is a temporary check for gradual rollout of subprojects scanning
  // TODO: delete once supported for monitor
  if (options['all-sub-projects']) {
    throw new Error('`--all-sub-projects` is currently not supported for `snyk monitor`');
  }

  return apiTokenExists('snyk monitor')
    .then(() => {
      return args.reduce((acc, path) => {
        return acc.then(() => {
          return fs.exists(path).then((exists) => {
            if (!exists && !options.docker) {
              throw new Error(
                '"' + path + '" is not a valid path for "snyk monitor"');
            }

            let packageManager = detect.detectPackageManager(path, options);

            const targetFile = options.docker && !options.file // snyk monitor --docker (without --file)
              ? undefined
              : (options.file || detect.detectPackageFile(path));

            const plugin = plugins.loadPlugin(packageManager, options);

            const moduleInfo = ModuleInfo(plugin, options.policy);

            const displayPath = pathUtil.relative(
              '.', pathUtil.join(path, targetFile || ''));

            const analysisType = options.docker ? 'docker' : packageManager;

            const analyzingDepsSpinnerLabel =
          'Analyzing ' + analysisType + ' dependencies for ' + displayPath;

            const postingMonitorSpinnerLabel =
          'Posting monitor snapshot for ' + displayPath + ' ...';

            return spinner(analyzingDepsSpinnerLabel)
              .then(() => {
                return moduleInfo.inspect(path, targetFile, options);
              })
            // clear spinner in case of success or failure
              .then(spinner.clear(analyzingDepsSpinnerLabel))
              .catch((error) => {
                spinner.clear(analyzingDepsSpinnerLabel)();
                throw error;
              })
              .then((info) => {
                return spinner(postingMonitorSpinnerLabel)
                  .then(() => {
                    return info;
                  });
              })
              .then((info) => {
                if (_.get(info, 'plugin.packageManager')) {
                  packageManager = info.plugin.packageManager;
                }
                const meta = {
                  'method': 'cli',
                  'packageManager': packageManager,
                  'policy-path': options['policy-path'],
                  'project-name':
                options['project-name'] || config.PROJECT_NAME,
                  'isDocker': !!options.docker,
                };
                return (snyk.monitor as any as (path, meta, info) => Promise<any>)(path, meta, info);
              })
            // clear spinner in case of success or failure
              .then(spinner.clear(postingMonitorSpinnerLabel))
              .catch((error) => {
                spinner.clear(postingMonitorSpinnerLabel)();
                throw error;
              })
              .then((res) => {
                res.path = path;
                const endpoint = url.parse(config.API);
                let leader = '';
                if (res.org) {
                  leader = '/org/' + res.org;
                }
                endpoint.pathname = leader + '/manage';
                const manageUrl = url.format(endpoint);

                endpoint.pathname = leader + '/monitor/' + res.id;
                const output = formatMonitorOutput(
                  packageManager,
                  res,
                  manageUrl,
                  options,
                );
                // push a good result
                results.push({ok: true, data: output, path});
              });
          }).catch((err) => {
          // push this error so the promise chain continues
            results.push({ok: false, data: err, path});
          });
        });
      }, Promise.resolve())
        .then(() => {
          if (options.json) {
            let dataToSend = results.map((result) => {
              if (result.ok) {
                return JSON.parse(result.data);
              }
              return {ok: false, error: result.data.message, path: result.path};
            });
            // backwards compat - strip array if only one result
            dataToSend = dataToSend.length === 1 ? dataToSend[0] : dataToSend;
            const json = JSON.stringify(dataToSend, null, 2);

            if (results.every((res) => {
              return res.ok;
            })) {
              return json;
            }

            throw new Error(json);
          }

          const output = results.map((res) => {
            if (res.ok) {
              return res.data;
            }

            const errorMessage = (res.data && res.data.userMessage) ?
              chalk.bold.red(res.data.userMessage) :
              (res.data ? res.data.message : 'Unknown error occurred.');

            return chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') +
              errorMessage;
          }).join('\n' + SEPARATOR);

          if (results.every((res) => {
            return res.ok;
          })) {
            return output;
          }

          throw new Error(output);
        });
    });
}

function formatMonitorOutput(packageManager, res, manageUrl, options) {
  const issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  let strOutput = chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') +
    (packageManager === 'yarn' ?
      'A yarn.lock file was detected - continuing as a Yarn project.\n' : '') +
      'Explore this snapshot at ' + res.uri + '\n\n' +
    (res.isMonitored ?
      'Notifications about newly disclosed ' + issues + ' related ' +
      'to these dependencies will be emailed to you.\n' :
      chalk.bold.red('Project is inactive, so notifications are turned ' +
        'off.\nActivate this project here: ' + manageUrl + '\n\n')) +
    (res.trialStarted ?
      chalk.yellow('You\'re over the free plan usage limit, \n' +
        'and are now on a free 14-day premium trial.\n' +
        'View plans here: ' + manageUrl + '\n\n') :
      '');

  if (docker.shouldSuggestDocker(options)) {
    strOutput += chalk.bold.white(docker.suggestionText);
  }

  return options.json ?
    JSON.stringify(_.assign({}, res, {
      manageUrl,
      packageManager,
    })) : strOutput;
}
