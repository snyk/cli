import * as _ from 'lodash';
import chalk from 'chalk';
import {MonitorResult } from '../../../../lib/types';

export function formatMonitorOutput(
  packageManager,
  res: MonitorResult,
  manageUrl,
  options,
  projectName?: string,
  advertiseSubprojectsCount?: number | null,
) {
  const issues = res.licensesPolicy ? 'issues' : 'vulnerabilities';
  const humanReadableName = projectName
    ? `${res.path} (${projectName})`
    : res.path;
  const strOutput =
    chalk.bold.white('\nMonitoring ' + humanReadableName + '...\n\n') +
    (packageManager === 'yarn'
      ? 'A yarn.lock file was detected - continuing as a Yarn project.\n'
      : '') +
    'Explore this snapshot at ' +
    res.uri +
    '\n\n' +
    (advertiseSubprojectsCount
      ? chalk.bold.white(
          `This project has multiple sub-projects (${advertiseSubprojectsCount}), ` +
            'use --all-sub-projects flag to scan all sub-projects.\n\n',
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
        _.assign({}, res, {
          manageUrl,
          packageManager,
        }),
      )
    : strOutput;
}
