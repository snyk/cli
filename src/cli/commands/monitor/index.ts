import chalk from 'chalk';
import * as fs from 'fs';
import * as Debug from 'debug';
import * as pathUtil from 'path';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { checkOSSPaths } from '../../../lib/check-paths';
import * as theme from '../../../lib/theme';

import {
  Options,
  Contributor,
  ProjectAttributes,
  PROJECT_CRITICALITY,
  PROJECT_ENVIRONMENT,
  PROJECT_LIFECYCLE,
  Tag,
} from '../../../lib/types';

import * as detect from '../../../lib/detect';
import { GoodResult, BadResult } from './types';
import { spinner } from '../../../lib/spinner';
import * as analytics from '../../../lib/analytics';
import { MethodArgs } from '../../args';
import { apiOrOAuthTokenExists } from '../../../lib/api-token';
import { processJsonMonitorResponse } from './process-json-monitor';
import snyk = require('../../../lib'); // TODO(kyegupov): fix import
import { getDepsFromPlugin } from '../../../lib/plugins/get-deps-from-plugin';
import { MultiProjectResultCustom } from '../../../lib/plugins/get-multi-plugin-result';
import { convertMultiResultToMultiCustom } from '../../../lib/plugins/convert-multi-plugin-res-to-multi-custom';
import { convertSingleResultToMultiCustom } from '../../../lib/plugins/convert-single-splugin-res-to-multi-custom';
import { getContributors } from '../../../lib/monitor/dev-count-analysis';
import {
  MonitorError,
  MissingArgError,
  ValidationError,
} from '../../../lib/errors';
import { isMultiProjectScan } from '../../../lib/is-multi-project-scan';
import { getEcosystem, monitorEcosystem } from '../../../lib/ecosystems';
import { getFormattedMonitorOutput } from '../../../lib/ecosystems/monitor';
import { processCommandArgs } from '../process-command-args';
import { hasFeatureFlag } from '../../../lib/feature-flags';
import { PNPM_FEATURE_FLAG } from '../../../lib/package-managers';
import { promiseOrCleanup } from './utils';
import { monitorProcessChunksCommand } from './process-chunks';

const SEPARATOR = '\n-------------------------------------------------------\n';
const debug = Debug('snyk');
const appVulnsReleaseWarningMsg = `${theme.icon.WARNING} Important: Beginning January 24th, 2023, application dependencies in container
images will be scanned by default when using the snyk container test/monitor
commands. If you are using Snyk in a CI pipeline, action may be required. Read
https://snyk.io/blog/securing-container-applications-using-the-snyk-cli/ for
more info.`;

// Returns an array of Registry responses (one per every sub-project scanned), a single response,
// or an error message.
export default async function monitor(...args0: MethodArgs): Promise<any> {
  const { options, paths } = processCommandArgs(...args0);
  const results: Array<GoodResult | BadResult> = [];

  if (options.id) {
    snyk.id = options.id;
  }

  if (options.allSubProjects && options['project-name']) {
    throw new Error(
      '`--all-sub-projects` is currently not compatible with `--project-name`',
    );
  }

  if (!options.docker) {
    checkOSSPaths(paths, options);
  }

  if (options.docker && options['remote-repo-url']) {
    throw new Error('`--remote-repo-url` is not supported for container scans');
  }
  if (options.docker) {
    // order is important here, we want:
    // 1) exclude-app-vulns set -> no app vulns
    // 2) app-vulns set -> app-vulns
    // 3) neither set -> containerAppVulnsEnabled
    if (options['exclude-app-vulns']) {
      options['exclude-app-vulns'] = true;
    } else if (options['app-vulns']) {
      options['exclude-app-vulns'] = false;
    } else {
      options['exclude-app-vulns'] = !(await hasFeatureFlag(
        'containerCliAppVulnsEnabled',
        options,
      ));

      // we can't print the warning message with JSON output as that would make
      // the JSON output invalid.
      // We also only want to print the message if the user did not overwrite
      // the default with one of the flags.
      if (
        options['exclude-app-vulns'] &&
        !options['json'] &&
        !options['sarif']
      ) {
        console.log(theme.color.status.warn(appVulnsReleaseWarningMsg));
      }
    }
  }

  // Handles no image arg provided to the container command until
  // a validation interface is implemented in the docker plugin.
  if (options.docker && paths.length === 0) {
    throw new MissingArgError();
  }

  apiOrOAuthTokenExists();

  let contributors: Contributor[] = [];
  if (!options.docker && analytics.allowAnalytics()) {
    try {
      contributors = await getContributors();
    } catch (err) {
      debug('error getting repo contributors', err);
    }
  }

  const ecosystem = getEcosystem(options);
  if (ecosystem) {
    const commandResult = await monitorEcosystem(
      ecosystem,
      paths,
      options,
      contributors,
    );

    const [monitorResults, monitorErrors] = commandResult;

    return await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      options,
    );
  }

  let hasPnpmSupport = false;
  try {
    hasPnpmSupport = (await hasFeatureFlag(
      PNPM_FEATURE_FLAG,
      options,
    )) as boolean;
  } catch (err) {
    hasPnpmSupport = false;
  }

  const featureFlags = hasPnpmSupport
    ? new Set<string>([PNPM_FEATURE_FLAG])
    : new Set<string>();

  // Part 1: every argument is a scan target; process them sequentially
  for (const path of paths) {
    debug(`Processing ${path}...`);
    try {
      validateMonitorPath(path, options.docker);
      let analysisType = 'all';
      let packageManager;
      if (isMultiProjectScan(options)) {
        analysisType = 'all';
      } else if (options.docker) {
        analysisType = 'docker';
      } else {
        packageManager = detect.detectPackageManager(
          path,
          options,
          featureFlags,
        );
      }
      const unsupportedPackageManagers: Array<{
        label: string;
        name: string;
      }> = [];
      const unsupportedPackageManager = unsupportedPackageManagers.find(
        (pm) => pm.name === packageManager,
      );
      if (unsupportedPackageManager) {
        return `${unsupportedPackageManager.label} projects do not currently support "snyk monitor"`;
      }
      const targetFile =
        !options.scanAllUnmanaged && options.docker && !options.file // snyk monitor --docker (without --file)
          ? undefined
          : options.file || detect.detectPackageFile(path, featureFlags);

      const displayPath = pathUtil.relative(
        '.',
        pathUtil.join(path, targetFile || ''),
      );

      const analyzingDepsSpinnerLabel =
        'Analyzing ' +
        (packageManager ? packageManager : analysisType) +
        ' dependencies for ' +
        displayPath;

      await spinner(analyzingDepsSpinnerLabel);

      // Scan the project dependencies via a plugin
      debug('getDepsFromPlugin ...');

      // each plugin will be asked to scan once per path
      // some return single InspectResult & newer ones return Multi
      const inspectResult = await promiseOrCleanup(
        getDepsFromPlugin(
          path,
          {
            ...options,
            path,
            packageManager,
          },
          featureFlags,
        ),
        spinner.clear(analyzingDepsSpinnerLabel),
      );
      analytics.add('pluginName', inspectResult.plugin.name);

      // We send results from "all-sub-projects" scanning as different Monitor objects
      // multi result will become default, so start migrating code to always work with it
      let perProjectResult: MultiProjectResultCustom;

      if (!pluginApi.isMultiResult(inspectResult)) {
        perProjectResult = convertSingleResultToMultiCustom(inspectResult);
      } else {
        perProjectResult = convertMultiResultToMultiCustom(inspectResult);
      }

      const failedResults = (inspectResult as MultiProjectResultCustom)
        .failedResults;
      if (failedResults?.length) {
        failedResults.forEach((result) => {
          results.push({
            ok: false,
            data: new MonitorError(500, result.errMessage),
            path: result.targetFile || '',
          });
        });
      }

      const postingMonitorSpinnerLabel =
        'Posting monitor snapshot for ' + displayPath + ' ...';
      await spinner(postingMonitorSpinnerLabel);

      // Post the project dependencies to the Registry
      const monitorResults = await monitorProcessChunksCommand(
        path,
        inspectResult,
        perProjectResult,
        contributors,
        options,
        targetFile,
      );

      monitorResults.forEach((res) => {
        results.push(res);
      });
    } catch (err) {
      // push this error, the loop continues
      results.push({ ok: false, data: err, path });
    } finally {
      spinner.clearAll();
    }
  }
  // Part 2: process the output from the Registry
  if (options.json) {
    return processJsonMonitorResponse(results);
  }

  const output = results
    .map((res) => {
      if (res.ok) {
        return res.data;
      }

      const errorMessage =
        res.data && res.data.userMessage
          ? chalk.bold.red(res.data.userMessage)
          : res.data
          ? res.data.message
          : 'Unknown error occurred.';

      return (
        chalk.bold.white('\nMonitoring ' + res.path + '...\n\n') + errorMessage
      );
    })
    .join('\n' + SEPARATOR);

  if (results.every((res) => res.ok)) {
    return output;
  }

  throw new Error(output);
}

/**
 * Parse an attribute from the CLI into the relevant enum type.
 *
 * @param attribute The project attribute (e.g. environment)
 * @param permitted Permitted options
 * @param options CLI options provided
 * @returns An array of attributes to set on the project or undefined to mean "do not touch".
 */
function getProjectAttribute<T>(
  attribute: string,
  permitted: Record<string, T>,
  options: Options,
): T[] | undefined {
  const permittedValues: T[] = Object.values(permitted);

  if (options[attribute] === undefined) {
    return undefined;
  }

  // Explicit flag to clear the existing values for this attribute already set on the project
  // e.g. if you specify --environment=
  // then this means you want to remove existing environment values on the project.
  if (options[attribute] === '') {
    return [];
  }

  // When it's specified without the =, we raise an explicit error to avoid
  // accidentally clearing the existing values.
  if (options[attribute] === true) {
    throw new ValidationError(
      `--${attribute} must contain an '=' with a comma-separated list of values. To clear all existing values, pass no values i.e. --${attribute}=`,
    );
  }

  const values = options[attribute].split(',');
  const extra = values.filter((value) => !permittedValues.includes(value));
  if (extra.length > 0) {
    throw new ValidationError(
      `${extra.length} invalid ${attribute}: ${extra.join(', ')}. ` +
        `Possible values are: ${permittedValues.join(', ')}`,
    );
  }

  return values;
}

export function validateProjectAttributes(options): void {
  // The validation is deep within the parsing, so call the generate but throw away the return for simplicity.
  // Using this method makes it much clearer what the intent is of the caller.
  generateProjectAttributes(options);
}

export function generateProjectAttributes(options): ProjectAttributes {
  return {
    criticality: getProjectAttribute(
      'project-business-criticality',
      PROJECT_CRITICALITY,
      options,
    ),
    environment: getProjectAttribute(
      'project-environment',
      PROJECT_ENVIRONMENT,
      options,
    ),
    lifecycle: getProjectAttribute(
      'project-lifecycle',
      PROJECT_LIFECYCLE,
      options,
    ),
  };
}

/**
 * Parse CLI --tags options into an internal data structure.
 *
 * If this returns undefined, it means "do not touch the existing tags on the project".
 *
 * Anything else means "replace existing tags on the project with this list" even if empty.
 *
 * @param options CLI options
 * @returns List of parsed tags or undefined if they are to be left untouched.
 */
export function generateTags(options): Tag[] | undefined {
  if (options['project-tags'] === undefined && options['tags'] === undefined) {
    return undefined;
  }

  if (options['project-tags'] !== undefined && options['tags'] !== undefined) {
    throw new ValidationError(
      'Only one of --tags or --project-tags may be specified, not both',
    );
  }

  const rawTags =
    options['tags'] === undefined ? options['project-tags'] : options['tags'];

  if (rawTags === '') {
    return [];
  }

  // When it's specified without the =, we raise an explicit error to avoid
  // accidentally clearing the existing tags;
  if (rawTags === true) {
    throw new ValidationError(
      `--project-tags must contain an '=' with a comma-separated list of pairs (also separated with an '='). To clear all existing values, pass no values i.e. --project-tags=`,
    );
  }

  const keyEqualsValuePairs = rawTags.split(',');

  const tags: Tag[] = [];
  for (const keyEqualsValue of keyEqualsValuePairs) {
    const parts = keyEqualsValue.split('=');
    if (parts.length !== 2) {
      throw new ValidationError(
        `The tag "${keyEqualsValue}" does not have an "=" separating the key and value. For example: --project-tag=KEY=VALUE`,
      );
    }
    tags.push({
      key: parts[0],
      value: parts[1],
    });
  }

  return tags;
}

export function validateTags(options): void {
  // The validation is deep within the parsing, so call the generate but throw away the return for simplicity.
  // Using this method makes it much clearer what the intent is of the caller.
  generateTags(options);
}

function validateMonitorPath(path: string, isDocker?: boolean): void {
  const exists = fs.existsSync(path);
  if (!exists && !isDocker) {
    throw new Error('"' + path + '" is not a valid path for "snyk monitor"');
  }
}
