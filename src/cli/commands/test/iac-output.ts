import chalk from 'chalk';
import * as Debug from 'debug';
import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../lib/snyk-test/iac-test-result';
import { getSeverityValue } from './formatters';
import { printPath } from './formatters/remediation-based-format-issues';
import { titleCaseText } from './formatters/legacy-format-issue';
import * as sarif from 'sarif';
import { SEVERITY } from '../../../lib/snyk-test/legacy';
import upperFirst = require('lodash/upperFirst');
const debug = Debug('iac-output');

function formatIacIssue(
  issue: AnnotatedIacIssue,
  isNew: boolean,
  path: string[],
): string {
  const severitiesColourMapping = {
    low: {
      colorFunc(text) {
        return chalk.blueBright(text);
      },
    },
    medium: {
      colorFunc(text) {
        return chalk.yellowBright(text);
      },
    },
    high: {
      colorFunc(text) {
        return chalk.redBright(text);
      },
    },
  };
  const newBadge = isNew ? ' (new)' : '';
  const name = issue.subType ? ` in ${chalk.bold(issue.subType)}` : '';

  let introducedBy = '';
  if (path) {
    // In this mode, we show only one path by default, for compactness
    const pathStr = printPath(path);
    introducedBy = `\n    introduced by ${pathStr}`;
  }

  const description = extractOverview(issue.description).trim();
  const descriptionLine = `\n    ${description}\n`;

  return (
    severitiesColourMapping[issue.severity].colorFunc(
      `  ✗ ${chalk.bold(issue.title)}${newBadge} [${titleCaseText(
        issue.severity,
      )} Severity]`,
    ) +
    ` [${issue.id}]` +
    name +
    introducedBy +
    descriptionLine
  );
}

function extractOverview(description: string): string {
  if (!description) {
    return '';
  }

  const overviewRegExp = /## Overview([\s\S]*?)(?=##|(# Details))/m;
  const overviewMatches = overviewRegExp.exec(description);
  return (overviewMatches && overviewMatches[1]) || '';
}

export function getIacDisplayedOutput(
  iacTest: IacTestResponse,
  testedInfoText: string,
  meta: string,
  prefix: string,
): string {
  const issuesTextArray = [
    chalk.bold.white('\nInfrastructure as code issues:'),
  ];

  const NotNew = false;

  const issues: AnnotatedIacIssue[] = iacTest.result.cloudConfigResults;
  debug(`iac display output - ${issues.length} issues`);

  issues
    .sort((a, b) => getSeverityValue(b.severity) - getSeverityValue(a.severity))
    .forEach((issue) => {
      issuesTextArray.push(
        formatIacIssue(issue, NotNew, issue.cloudConfigPath),
      );
    });

  const issuesInfoOutput: string[] = [];
  debug(`Iac display output - ${issuesTextArray.length} issues text`);
  if (issuesTextArray.length > 0) {
    issuesInfoOutput.push(issuesTextArray.join('\n'));
  }

  let body = issuesInfoOutput.join('\n\n') + '\n\n' + meta;

  const vulnCountText = `found ${issues.length} issues`;
  const summary = testedInfoText + ', ' + chalk.red.bold(vulnCountText);

  body = body + '\n\n' + summary;

  return prefix + body;
}

export function capitalizePackageManager(type) {
  switch (type) {
    case 'k8sconfig': {
      return 'Kubernetes';
    }
    case 'helmconfig': {
      return 'Helm';
    }
    case 'terraformconfig': {
      return 'Terraform';
    }
    default: {
      return 'Infrastracture as Code';
    }
  }
}

export function createSarifOutputForIac(
  iacTestResponses: IacTestResponse[],
): sarif.Log {
  const sarifRes: sarif.Log = {
    version: '2.1.0',
    runs: [],
  };

  iacTestResponses
    .filter((iacTestResponse) => iacTestResponse.result?.cloudConfigResults)
    .forEach((iacTestResponse) => {
      sarifRes.runs.push({
        tool: mapIacTestResponseToSarifTool(iacTestResponse),
        results: mapIacTestResponseToSarifResults(iacTestResponse),
      });
    });

  return sarifRes;
}

function getIssueLevel(severity: SEVERITY): sarif.ReportingConfiguration.level {
  return severity === SEVERITY.HIGH ? 'error' : 'warning';
}

const iacTypeToText = {
  k8s: 'Kubernetes',
  terraform: 'Terraform',
};

export function mapIacTestResponseToSarifTool(
  iacTestResponse: IacTestResponse,
): sarif.Tool {
  const tool: sarif.Tool = {
    driver: {
      name: 'Snyk Infrastructure as Code',
      rules: [],
    },
  };

  const pushedIds = {};
  iacTestResponse.result.cloudConfigResults.forEach(
    (iacIssue: AnnotatedIacIssue) => {
      if (pushedIds[iacIssue.id]) {
        return;
      }
      tool.driver.rules?.push({
        id: iacIssue.id,
        shortDescription: {
          text: `${upperFirst(iacIssue.severity)} severity - ${iacIssue.title}`,
        },
        fullDescription: {
          text: `${iacTypeToText[iacIssue.type]} ${iacIssue.subType}`,
        },
        help: {
          text: '',
          markdown: iacIssue.description,
        },
        defaultConfiguration: {
          level: getIssueLevel(iacIssue.severity),
        },
        properties: {
          tags: ['security', `${iacIssue.type}/${iacIssue.subType}`],
        },
      });
      pushedIds[iacIssue.id] = true;
    },
  );
  return tool;
}

export function mapIacTestResponseToSarifResults(
  iacTestResponse: IacTestResponse,
): sarif.Result[] {
  return iacTestResponse.result.cloudConfigResults.map(
    (iacIssue: AnnotatedIacIssue) => ({
      ruleId: iacIssue.id,
      message: {
        text: `This line contains a potential ${
          iacIssue.severity
        } severity misconfiguration affecting the ${
          iacTypeToText[iacIssue.type]
        } ${iacIssue.subType}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: iacTestResponse.targetFile,
            },
            region: {
              startLine: iacIssue.lineNumber,
            },
          },
        },
      ],
    }),
  );
}
