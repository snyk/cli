import { Options, OutputDataTypes, TestOptions } from '../../../../lib/types';
import {
  getReachabilityJson,
  summariseReachableVulns,
} from './format-reachability';
import {
  GroupedVuln,
  SEVERITY,
  TestResult,
  VulnMetaData,
} from '../../../../lib/snyk-test/legacy';
import chalk from 'chalk';
import {
  SupportedPackageManagers,
  WIZARD_SUPPORTED_PACKAGE_MANAGERS,
} from '../../../../lib/package-managers';
import * as config from '../../../../lib/config';
const cloneDeep = require('lodash.clonedeep');
const orderBy = require('lodash.orderby');
import * as analytics from '../../../../lib/analytics';
import {
  formatIssuesWithRemediation,
  getSeverityValue,
} from './remediation-based-format-issues';
import { formatIssues } from './legacy-format-issue';
import { formatDockerBinariesIssues } from './docker';
import { createSarifOutputForContainers } from '../container-sarif-output';
import { createSarifOutputForIac } from '../iac-output';
import { isNewVuln, isVulnFixable } from '../vuln-helpers';
import { jsonStringifyLargeObject } from '../../../../lib/json';
import { createSarifOutputForOpenSource } from '../open-source-sarif-output';

export function formatJsonOutput(jsonData, options: Options) {
  const jsonDataClone = cloneDeep(jsonData);

  if (options['group-issues']) {
    jsonDataClone.vulnerabilities = Object.values(
      (jsonDataClone.vulnerabilities || []).reduce((acc, vuln): Record<
        string,
        any
      > => {
        vuln.from = [vuln.from].concat(acc[vuln.id]?.from || []);
        vuln.name = [vuln.name].concat(acc[vuln.id]?.name || []);
        acc[vuln.id] = vuln;
        return acc;
      }, {}),
    );
  }

  if (jsonDataClone.vulnerabilities) {
    jsonDataClone.vulnerabilities.forEach((vuln) => {
      if (vuln.reachability) {
        vuln.reachability = getReachabilityJson(vuln.reachability);
      }
    });
  }
  return jsonDataClone;
}

export function extractDataToSendFromResults(
  results,
  jsonData,
  options: Options,
): OutputDataTypes {
  let sarifData = {};
  let stringifiedSarifData = '';
  if (options.sarif || options['sarif-file-output']) {
    if (options.iac) {
      sarifData = createSarifOutputForIac(results);
    } else if (options.docker) {
      sarifData = createSarifOutputForContainers(results);
    } else {
      sarifData = createSarifOutputForOpenSource(results);
    }
    stringifiedSarifData = jsonStringifyLargeObject(sarifData);
  }

  let stringifiedJsonData = '';
  if (options.json || options['json-file-output']) {
    stringifiedJsonData = jsonStringifyLargeObject(
      formatJsonOutput(jsonData, options),
    );
  }

  const dataToSend = options.sarif ? sarifData : jsonData;
  const stringifiedData = options.sarif
    ? stringifiedSarifData
    : stringifiedJsonData;

  return {
    stdout: dataToSend, // this is for the human-readable stdout output and is set (but not used) even if --json or --sarif is set
    stringifiedData, // this will be used to display either the Snyk or SARIF format JSON to stdout if --json or --sarif is set
    stringifiedJsonData, // this will be used for the --json-file-output=<file.json> option
    stringifiedSarifData, // this will be used for the --sarif-file-output=<file.json> option
  };
}

export function createErrorMappedResultsForJsonOutput(results) {
  const errorMappedResults = results.map((result) => {
    // add json for when thrown exception
    if (result instanceof Error) {
      return {
        ok: false,
        error: result.message,
        path: (result as any).path,
      };
    }
    return result;
  });

  return errorMappedResults;
}

export function getDisplayedOutput(
  res: TestResult,
  options: Options & TestOptions,
  testedInfoText: string,
  localPackageTest: any,
  projectType: string,
  meta: string,
  prefix: string,
  multiProjAdvice: string,
  dockerAdvice: string,
): string {
  const vulnCount = res.vulnerabilities && res.vulnerabilities.length;
  const singleVulnText = res.licensesPolicy ? 'issue' : 'vulnerability';
  const multipleVulnsText = res.licensesPolicy ? 'issues' : 'vulnerabilities';

  // Text will look like so:
  // 'found 232 vulnerabilities, 404 vulnerable paths.'
  let vulnCountText =
    `found ${res.uniqueCount} ` +
    (res.uniqueCount === 1 ? singleVulnText : multipleVulnsText);

  // Docker is currently not supported as num of paths is inaccurate due to trimming of paths to reduce size.
  if (options.showVulnPaths && !options.docker) {
    vulnCountText += `, ${vulnCount} vulnerable `;

    if (vulnCount === 1) {
      vulnCountText += 'path.';
    } else {
      vulnCountText += 'paths.';
    }
  } else {
    vulnCountText += '.';
  }

  const reachableVulnsText =
    options.reachableVulns && vulnCount > 0
      ? ` ${summariseReachableVulns(res.vulnerabilities)}`
      : '';

  const summary =
    testedInfoText +
    ', ' +
    chalk.red.bold(vulnCountText) +
    chalk.blue.bold(reachableVulnsText);
  let wizardAdvice = '';

  if (
    localPackageTest &&
    WIZARD_SUPPORTED_PACKAGE_MANAGERS.includes(
      projectType as SupportedPackageManagers,
    )
  ) {
    wizardAdvice = chalk.bold.green(
      '\n\nRun `snyk wizard` to address these issues.',
    );
  }
  const dockerSuggestion = getDockerSuggestionText(options, config);

  const vulns = res.vulnerabilities || [];
  const groupedVulns: GroupedVuln[] = groupVulnerabilities(vulns);
  const sortedGroupedVulns = orderBy(
    groupedVulns,
    ['metadata.severityValue', 'metadata.name'],
    ['asc', 'desc'],
  );
  const filteredSortedGroupedVulns = sortedGroupedVulns.filter(
    (vuln) => vuln.metadata.packageManager !== 'upstream',
  );
  const binariesSortedGroupedVulns = sortedGroupedVulns.filter(
    (vuln) => vuln.metadata.packageManager === 'upstream',
  );

  let groupedVulnInfoOutput;
  if (res.remediation) {
    analytics.add('actionableRemediation', true);
    groupedVulnInfoOutput = formatIssuesWithRemediation(
      filteredSortedGroupedVulns,
      res.remediation,
      options,
    );
  } else {
    analytics.add('actionableRemediation', false);
    groupedVulnInfoOutput = filteredSortedGroupedVulns.map((vuln) =>
      formatIssues(vuln, options),
    );
  }

  const groupedDockerBinariesVulnInfoOutput =
    res.docker && binariesSortedGroupedVulns.length
      ? formatDockerBinariesIssues(
          binariesSortedGroupedVulns,
          res.docker.binariesVulns,
          options,
        )
      : [];

  let body =
    groupedVulnInfoOutput.join('\n\n') +
    '\n\n' +
    groupedDockerBinariesVulnInfoOutput.join('\n\n') +
    '\n\n' +
    meta;

  if (res.remediation) {
    body = summary + body + wizardAdvice;
  } else {
    body = body + '\n\n' + summary + wizardAdvice;
  }

  const ignoredIssues = '';
  const dockerCTA = dockerUserCTA(options);
  return (
    prefix +
    body +
    multiProjAdvice +
    ignoredIssues +
    dockerAdvice +
    dockerSuggestion +
    dockerCTA
  );
}

export function dockerUserCTA(options) {
  if (options.isDockerUser) {
    return '\n\nFor more free scans that keep your images secure, sign up to Snyk at https://dockr.ly/3ePqVcp';
  }
  return '';
}

function getDockerSuggestionText(options, config): string {
  if (!options.docker || options.isDockerUser) {
    return '';
  }

  let dockerSuggestion = '';
  if (config && config.disableSuggestions !== 'true') {
    const optOutSuggestions =
      '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`';
    if (!options.file) {
      dockerSuggestion +=
        chalk.bold.white(
          '\n\nPro tip: use `--file` option to get base image remediation advice.' +
            `\nExample: $ snyk test --docker ${options.path} --file=path/to/Dockerfile`,
        ) + optOutSuggestions;
    } else if (!options['exclude-base-image-vulns']) {
      dockerSuggestion +=
        chalk.bold.white(
          '\n\nPro tip: use `--exclude-base-image-vulns` to exclude from display Docker base image vulnerabilities.',
        ) + optOutSuggestions;
    }
  }
  return dockerSuggestion;
}

function groupVulnerabilities(vulns): GroupedVuln[] {
  return vulns.reduce((map, curr) => {
    if (!map[curr.id]) {
      map[curr.id] = {};
      map[curr.id].list = [];
      map[curr.id].metadata = metadataForVuln(curr);
      map[curr.id].isIgnored = false;
      map[curr.id].isPatched = false;
      // Extra added fields for ease of handling
      map[curr.id].title = curr.title;
      map[curr.id].note = curr.note;
      map[curr.id].severity = curr.severity as SEVERITY;
      map[curr.id].originalSeverity = curr.originalSeverity as SEVERITY;
      map[curr.id].isNew = isNewVuln(curr);
      map[curr.id].name = curr.name;
      map[curr.id].version = curr.version;
      map[curr.id].fixedIn = curr.fixedIn;
      map[curr.id].dockerfileInstruction = curr.dockerfileInstruction;
      map[curr.id].dockerBaseImage = curr.dockerBaseImage;
      map[curr.id].nearestFixedInVersion = curr.nearestFixedInVersion;
      map[curr.id].legalInstructionsArray = curr.legalInstructionsArray;
      map[curr.id].reachability = curr.reachability;
    }

    map[curr.id].list.push(curr);
    if (!map[curr.id].isFixable) {
      map[curr.id].isFixable = isVulnFixable(curr);
    }

    if (!map[curr.id].note) {
      map[curr.id].note = !!curr.note;
    }

    return map;
  }, {});
}

function metadataForVuln(vuln): VulnMetaData {
  return {
    id: vuln.id,
    title: vuln.title,
    description: vuln.description,
    type: vuln.type,
    name: vuln.name,
    info: vuln.info,
    severity: vuln.severity,
    severityValue: getSeverityValue(vuln.severity),
    isNew: isNewVuln(vuln),
    version: vuln.version,
    packageManager: vuln.packageManager,
  };
}
