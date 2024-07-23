import {
  Options,
  OutputDataTypes,
  SupportedProjectTypes,
  TestOptions,
} from '../../types';
import {
  GroupedVuln,
  SEVERITY,
  TestResult,
  VulnMetaData,
} from '../../snyk-test/legacy';
import chalk from 'chalk';
import config from '../../config';
import * as cloneDeep from 'lodash.clonedeep';
import * as orderBy from 'lodash.orderby';
import * as analytics from '../../analytics';
import { formatIssuesWithRemediation } from '../remediation-based-format-issues';
import { formatIssues } from '../legacy-format-issue';
import { formatDockerBinariesIssues } from '../docker';
import { createSarifOutputForContainers } from '../sarif-output';
import { createSarifOutputForIac } from '../iac-output/sarif';
import { isNewVuln, isVulnFixable } from '../../vuln-helpers';
import { jsonStringifyLargeObject } from '../../json';
import { createSarifOutputForOpenSource } from '../open-source-sarif-output';
import { getSeverityValue } from '../get-severity-value';
import { showFixTip } from '../show-fix-tip';
import {
  DockerFileAnalysisErrorCode,
  facts as dockerFacts,
} from 'snyk-docker-plugin/dist';
import { ScanResult } from '../../ecosystems/types';

function createJsonResultOutput(jsonResult, options: Options) {
  const jsonResultClone = cloneDeep(jsonResult);
  delete jsonResultClone.scanResult;

  formatJsonVulnerabilityStructure(jsonResultClone, options);
  return jsonResultClone;
}

function formatJsonVulnerabilityStructure(jsonResult, options: Options) {
  if (options['group-issues']) {
    // Note: we have to reverse the array to keep the existing behavior so that the json output will stay the same.
    // Since the entire array is reversed before grouping, we reverse it back after grouping to preserve the grouped vulns order.
    const reversedVulnerabilities = jsonResult.vulnerabilities
      ? jsonResult.vulnerabilities.slice().reverse()
      : [];
    jsonResult.vulnerabilities = Object.values(
      reversedVulnerabilities.reduce((acc, vuln): Record<string, any> => {
        if (!acc[vuln.id]) {
          acc[vuln.id] = {
            ...vuln,
            from: [vuln.from],
            name: [vuln.name],
          };
        } else {
          acc[vuln.id].from.push(vuln.from);
          acc[vuln.id].name.push(vuln.name);
        }
        return acc;
      }, {}),
    ).reverse();
  }
}

export function extractDataToSendFromResults(
  results,
  mappedResults,
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

  const jsonResults = mappedResults.map((res) =>
    createJsonResultOutput(res, options),
  );

  // backwards compat - strip array IFF only one result
  let jsonData = jsonResults.length === 1 ? jsonResults[0] : jsonResults;

  // for container projects, we want the app vulns data to be a part of the result object
  if (options.docker && jsonResults.length > 1 && !options.experimental) {
    const appVulnsData = jsonData.splice(1);
    jsonData = jsonData[0];
    if (jsonData.vulnerabilities?.length === 0) {
      // to avoid confusion with other vulns that might be found
      jsonData.summary = 'No known operating system vulnerabilities';
    }
    jsonData['applications'] = appVulnsData;
  }

  let stringifiedJsonData = '';
  if (options.json || options['json-file-output']) {
    stringifiedJsonData = jsonStringifyLargeObject(jsonData);
  }

  const dataToSend = options.sarif ? sarifData : jsonData;
  const stringifiedData = options.sarif
    ? stringifiedSarifData
    : stringifiedJsonData;

  return {
    stdout: dataToSend, // this is for the human-readable stdout output and is set even if --json or --sarif is set
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
  projectType: SupportedProjectTypes,
  meta: string,
  prefix: string,
  hasUnknownVersions: string,
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

  const summary =
    testedInfoText + ', ' + chalk.red.bold(vulnCountText) + hasUnknownVersions;

  const fixTip = showFixTip(projectType, res, options);
  const fixAdvice = fixTip ? `\n\n${fixTip}` : '';

  const dockerfileWarning = getDockerfileWarning(res.scanResult);
  const dockerSuggestion = getDockerSuggestionText(options, res);
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

function getDockerSuggestionText(
  options: Options & TestOptions,
  result: TestResult,
): string {
  if (
    config?.disableSuggestions === 'true' ||
    !options.docker ||
    options.isDockerUser
  ) {
    return '';
  }

  const tips: string[] = [];
  // exclude-base-image-vulns flag tip
  if (options.file && !options['exclude-base-image-vulns']) {
    tips.push(
      'Pro tip: use `--exclude-base-image-vulns` to exclude from display Docker base image vulnerabilities.',
    );
  }

  // dockerfile flag tip for base image
  if (!options.file && !result?.docker?.baseImage) {
    tips.push(
      `Snyk wasn’t able to auto detect the base image, use \`--file\` option to get base image remediation advice.
Example: $ snyk container test ${options.path} --file=path/to/Dockerfile`,
    );
  }

  // disable-app-vulns flag tip
  if (options.docker && result.targetFile && result.uniqueCount > 0) {
    tips.push(
      'Snyk found some vulnerabilities in your image applications (Snyk searches for these vulnerabilities by default). See https://snyk.co/app-vulns for more information.',
    );
  }

  if (tips.length === 0) {
    return '';
  }

  return (
    '\n\n' +
    tips
      // not sure why the tip to disable tips wasn't marked as white, maybe we should change that too?
      .map((tip) => chalk.bold.white(tip))
      .concat(
        // add tip to disable tips
        `To remove ${
          tips.length > 1 ? 'these messages' : 'this message'
        } in the future, please run \`snyk config set disableSuggestions=true\``,
      )
      .join('\n\n')
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

export function groupVulnerabilities(vulns): {
  [vulnId: string]: GroupedVuln;
} {
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
      map[curr.id].severityReason = curr.severityReason;
      map[curr.id].appliedPolicyRules = curr.appliedPolicyRules;
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
