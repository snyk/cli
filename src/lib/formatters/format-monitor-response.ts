const assign = require('lodash.assign');
import chalk from 'chalk';
import * as url from 'url';

import { MonitorResult } from '../types';
import * as config from '../config';

export function formatErrorMonitorOutput(
  packageManager,
  res: MonitorResult,
  options,
  projectName?: string,
): string {
  const humanReadableName = projectName
    ? `${res.path} (${projectName})`
    : res.path;
  const strOutput =
    chalk.bold.white('\nMonitoring ' + humanReadableName + '...\n\n') +
    '\n\n' +
    (packageManager === 'maven'
      ? chalk.yellow('Detected 0 dependencies (no project created)')
      : '');
  return options.json
    ? JSON.stringify(
        assign({}, res, {
          packageManager,
        }),
      )
    : strOutput;
}

export function formatMonitorOutput(
  packageManager,
  res: MonitorResult,
  options,
  projectName?: string,
  foundProjectCount?: number,
): string {
  const manageUrl = buildManageUrl(res.id, res.org);
  const advertiseGradleSubProjectsCount =
    packageManager === 'gradle' &&
    !options['gradle-sub-project'] &&
    !options.allProjects;
  const advertiseAllProjectsCount =
    packageManager !== 'gradle' && !options.allProjects && foundProjectCount;
  const issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  const humanReadableName = projectName
    ? `${res.path} (${projectName})`
    : res.path;
  const strOutput =
    chalk.bold.white('\nMonitoring ' + humanReadableName + '...\n\n') +
    'Explore this snapshot at ' +
    res.uri +
    '\n\n' +
    (advertiseGradleSubProjectsCount && foundProjectCount
      ? chalk.bold.white(
          `Tip: This project has multiple sub-projects (${foundProjectCount}), ` +
            'use --all-sub-projects flag to scan all sub-projects.\n\n',
        )
      : '') +
    (advertiseAllProjectsCount && foundProjectCount
      ? chalk.bold.white(
          `Tip: Detected multiple supported manifests (${foundProjectCount}), ` +
            'use --all-projects to scan all of them at once.\n\n',
        )
      : '') +
    (res.isMonitored
      ? 'Notifications about newly disclosed ' +
        issues +
        ' related ' +
        'to these dependencies will be emailed to you.\n'
      : chalk.bold.red(
          'Project is inactive, so notifications are turned ' +
            'off.\nActivate this project here: ' +
            manageUrl +
            '\n\n',
        )) +
    (res.trialStarted
      ? chalk.yellow(
          "You're over the free plan usage limit, \n" +
            'and are now on a free 14-day premium trial.\n' +
            'View plans here: ' +
            manageUrl +
            '\n\n',
        )
      : '');

  return options.json
    ? JSON.stringify(
        assign({}, res, {
          manageUrl,
          packageManager,
        }),
      )
    : strOutput;
}

function buildManageUrl(resId: string, org?: string): string {
  const endpoint = url.parse(config.API);
  let leader = '';
  if (org) {
    leader = '/org/' + org;
  }
  endpoint.pathname = leader + '/manage';
  const manageUrl = url.format(endpoint);

  // TODO: what was this meant to do?
  endpoint.pathname = leader + '/monitor/' + resId;
  return manageUrl;
}
