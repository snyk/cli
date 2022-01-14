import { Options, SupportedProjectTypes, TestOptions } from '../../types';

import {
  GroupedVuln,
  SEVERITY,
  TestResult,
  VulnMetaData,
} from '../../snyk-test/legacy';
import { summariseReachableVulns } from '../format-reachability';
import chalk from 'chalk';
import config from '../../config';
const orderBy = require('lodash.orderby');
import * as analytics from '../../analytics';
import { formatIssuesWithRemediation } from '../remediation-based-format-issues';
import { formatIssues } from '../legacy-format-issue';
import { formatDockerBinariesIssues } from '../docker';

import { isNewVuln, isVulnFixable } from '../../vuln-helpers';

import { getSeverityValue } from '../get-severity-value';
import { showFixTip } from '../show-fix-tip';
import {
  DockerFileAnalysisErrorCode,
  facts as dockerFacts,
} from 'snyk-docker-plugin/dist';
import { ScanResult } from '../../ecosystems/types';

interface GroupedVulns {
  [vulnId: string]: GroupedVuln;
}
export function groupVulnerabilities(vulns): GroupedVulns {
  const groupedVulns = {};
  for (const vuln of vulns) {
    if (vuln?.id && !groupedVulns[vuln.id]) {
      groupedVulns[vuln.id] = {};
      groupedVulns[vuln.id] = {
        list: [],
        metadata: metadataForVuln(vuln),
        isIgnored: false,
        isPatched: false,
        // Extra added fields for ease of handling
        title: vuln.title,
        note: vuln.note,
        severity: vuln.severity as SEVERITY,
        originalSeverity: vuln.originalSeverity as SEVERITY,
        isNew: isNewVuln(vuln),
        name: vuln.name,
        version: vuln.version,
        fixedIn: vuln.fixedIn,
        dockerfileInstruction: vuln.dockerfileInstruction,
        dockerBaseImage: vuln.dockerBaseImage,
        nearestFixedInVersion: vuln.nearestFixedInVersion,
        legalInstructionsArray: vuln.legalInstructionsArray,
        reachability: vuln.reachability,
      };
    }
    groupedVulns[vuln.id].list.push(vuln);
    if (!groupedVulns[vuln.id].isFixable) {
      groupedVulns[vuln.id].isFixable = isVulnFixable(vuln);
    }

    if (!groupedVulns[vuln.id].note) {
      groupedVulns[vuln.id].note = !!vuln.note;
    }
  }
  return groupedVulns;
}

export function getDisplayedOutput(
  res: TestResult,
  options: Options & TestOptions,
  testedInfoText: string,
  localPackageTest: any,
  projectType: SupportedProjectTypes,
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

  const fixTip = showFixTip(projectType, res, options);
  const fixAdvice = fixTip ? `\n\n${fixTip}` : '';

  const dockerfileWarning = getDockerfileWarning(res.scanResult);
  const dockerSuggestion = getDockerSuggestionText(
    options,
    config,
    res?.docker?.baseImage,
  );
  const dockerDocsLink = getDockerRemediationDocsLink(dockerAdvice, config);

  const vulns = res.vulnerabilities || [];
  const groupedVulns = groupVulnerabilities(vulns);
  const sortedGroupedVulns: GroupedVuln[] = orderBy(
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
    body = summary + body + fixAdvice;
  } else {
    body = body + '\n\n' + summary + fixAdvice;
  }

  const ignoredIssues = '';
  const dockerCTA = dockerUserCTA(options);
  return (
    prefix +
    body +
    multiProjAdvice +
    ignoredIssues +
    dockerAdvice +
    dockerfileWarning +
    dockerSuggestion +
    dockerDocsLink +
    dockerCTA
  );
}
export function dockerUserCTA(options) {
  if (options.isDockerUser) {
    return '\n\nFor more free scans that keep your images secure, sign up to Snyk at https://dockr.ly/3ePqVcp';
  }
  return '';
}
function getDockerRemediationDocsLink(dockerAdvice: string, config): string {
  if (config.disableSuggestions === 'true' || dockerAdvice.length === 0) {
    return '';
  }

  return (
    chalk.white('\n\nLearn more: ') +
    chalk.white.underline(
      'https://docs.snyk.io/products/snyk-container/getting-around-the-snyk-container-ui/base-image-detection',
    )
  );
}

function getDockerfileWarning(scanResult: ScanResult | undefined): string {
  if (!scanResult) {
    return '';
  }

  const fact = scanResult.facts.find(
    (fact) => fact.type === 'dockerfileAnalysis',
  );
  if (!fact) {
    return '';
  }

  const dockerfileAnalysisFact = fact as dockerFacts.DockerfileAnalysisFact;
  if (!dockerfileAnalysisFact.data.error) {
    return '';
  }

  let userMessage = chalk.yellow(
    '\n\nWarning: Unable to analyse Dockerfile provided through `--file`.',
  );

  switch (dockerfileAnalysisFact.data.error.code) {
    case DockerFileAnalysisErrorCode.BASE_IMAGE_NAME_NOT_FOUND:
      userMessage += chalk.yellow(
        '\n         Dockerfile must begin with a FROM instruction. This may be after parser directives, comments, and globally scoped ARGs.',
      );
      break;
    case DockerFileAnalysisErrorCode.BASE_IMAGE_NON_RESOLVABLE:
      userMessage += chalk.yellow(
        '\n         Dockerfile must have default values for all ARG instructions.',
      );
      break;
  }

  return userMessage;
}

function getDockerSuggestionText(options, config, baseImageRes): string {
  if (!options.docker || options.isDockerUser) {
    return '';
  }

  let dockerSuggestion = '';
  if (config && config.disableSuggestions !== 'true') {
    const optOutSuggestions =
      '\n\nTo remove this message in the future, please run `snyk config set disableSuggestions=true`';
    if (!options.file) {
      if (!baseImageRes) {
        dockerSuggestion +=
          chalk.bold.white(
            '\n\nSnyk wasn’t able to auto detect the base image, use `--file` option to get base image remediation advice.' +
              `\nExample: $ snyk container test ${options.path} --file=path/to/Dockerfile`,
          ) + optOutSuggestions;
      }
    } else if (!options['exclude-base-image-vulns']) {
      dockerSuggestion +=
        chalk.bold.white(
          '\n\nPro tip: use `--exclude-base-image-vulns` to exclude from display Docker base image vulnerabilities.',
        ) + optOutSuggestions;
    }
  }
  return dockerSuggestion;
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
