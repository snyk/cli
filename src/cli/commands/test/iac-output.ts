import chalk from 'chalk';
import * as Debug from 'debug';
import * as pathLib from 'path';
import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../lib/snyk-test/iac-test-result';
import { getSeverityValue } from './formatters';
import { printPath } from './formatters/remediation-based-format-issues';
import { titleCaseText } from './formatters/legacy-format-issue';
import * as sarif from 'sarif';
import { SEVERITY } from '../../../lib/snyk-test/legacy';
import { getSeveritiesColour } from '../../../lib/snyk-test/common';
import { IacFileInDirectory } from '../../../lib/types';
import upperFirst = require('lodash.upperfirst');
import { isLocalFolder } from '../../../lib/detect';
const debug = Debug('iac-output');

function formatIacIssue(
  issue: AnnotatedIacIssue,
  isNew: boolean,
  path: string[],
): string {
  const newBadge = isNew ? ' (new)' : '';
  const name = issue.subType ? ` in ${chalk.bold(issue.subType)}` : '';

  let introducedBy = '';
  if (path) {
    // In this mode, we show only one path by default, for compactness
    const pathStr = printPath(path);
    introducedBy = `\n    introduced by ${pathStr}`;
  }

  const severityColor = getSeveritiesColour(issue.severity);

  return (
    severityColor.colorFunc(
      `  ✗ ${chalk.bold(issue.title)}${newBadge} [${titleCaseText(
        issue.severity,
      )} Severity]`,
    ) +
    ` [${issue.id}]` +
    name +
    introducedBy +
    '\n'
  );
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

export function getIacDisplayErrorFileOutput(
  iacFileResult: IacFileInDirectory,
): string {
  const fileName = pathLib.basename(iacFileResult.filePath);
  return `

-------------------------------------------------------

Testing ${fileName}...

${iacFileResult.failureReason}`;
}

export function capitalizePackageManager(type: string | undefined) {
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
    case 'cloudformationconfig': {
      return 'CloudFormation';
    }
    default: {
      return 'Infrastracture as Code';
    }
  }
}

type ResponseIssues = { issue: AnnotatedIacIssue; targetPath: string }[];

// Used to reference the base path in results.
const PROJECT_ROOT_KEY = 'PROJECTROOT';

export function createSarifOutputForIac(
  iacTestResponses: IacTestResponse[],
): sarif.Log {
  // If the CLI scans a singular file, then the base path is the current working directory
  // Otherwise it's the computed path
  const basePath = isLocalFolder(iacTestResponses[0].path)
    ? pathLib.resolve('.', iacTestResponses[0].path)
    : pathLib.resolve('.');
  const issues = iacTestResponses.reduce((collect: ResponseIssues, res) => {
    if (res.result) {
      // targetFile is the computed relative path of the scanned file
      // so needs to be cleaned up before assigning to the URI
      const targetPath = res.targetFile.replace(/\\/g, '/');
      const mapped = res.result.cloudConfigResults.map((issue) => ({
        issue,
        targetPath,
      }));
      collect.push(...mapped);
    }
    return collect;
  }, []);

  const tool: sarif.Tool = {
    driver: {
      name: 'Snyk Infrastructure as Code',
      rules: extractReportingDescriptor(issues),
    },
  };
  return {
    version: '2.1.0',
    runs: [
      {
        // https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html#_Toc34317498
        originalUriBaseIds: {
          [PROJECT_ROOT_KEY]: {
            uri: 'file://' + pathLib.join(basePath, '/').replace(/\\/g, '/'),
            description: {
              text: 'The root directory for all project files.',
            },
          },
        },

        tool,
        results: mapIacTestResponseToSarifResults(issues),
      },
    ],
  };
}

function getIssueLevel(severity: SEVERITY): sarif.ReportingConfiguration.level {
  return severity === SEVERITY.HIGH ? 'error' : 'warning';
}

const iacTypeToText = {
  k8s: 'Kubernetes',
  terraform: 'Terraform',
};

export function extractReportingDescriptor(
  results: ResponseIssues,
): sarif.ReportingDescriptor[] {
  const tool: Record<string, sarif.ReportingDescriptor> = {};

  results.forEach(({ issue }) => {
    if (tool[issue.id]) {
      return;
    }
    tool[issue.id] = {
      id: issue.id,
      shortDescription: {
        text: `${upperFirst(issue.severity)} severity - ${issue.title}`,
      },
      fullDescription: {
        text: `${iacTypeToText[issue.type]} ${issue.subType}`,
      },
      help: {
        text: `The issue is... \n${issue.iacDescription.issue}\n\n The impact of this is... \n ${issue.iacDescription.impact}\n\n You can resolve this by... \n${issue.iacDescription.resolve}`.replace(
          /^\s+/g,
          '',
        ),
        markdown: `**The issue is...** \n${issue.iacDescription.issue}\n\n **The impact of this is...** \n ${issue.iacDescription.impact}\n\n **You can resolve this by...** \n${issue.iacDescription.resolve}`.replace(
          /^\s+/g,
          '',
        ),
      },
      defaultConfiguration: {
        level: getIssueLevel(issue.severity),
      },
      properties: {
        tags: ['security', `${issue.type}/${issue.subType}`],
        documentation: issue.documentation,
      },
    };
  });

  return Object.values(tool);
}

export function mapIacTestResponseToSarifResults(
  issues: ResponseIssues,
): sarif.Result[] {
  return issues.map(({ targetPath, issue }) => ({
    ruleId: issue.id,
    message: {
      text: `This line contains a potential ${
        issue.severity
      } severity misconfiguration affecting the ${iacTypeToText[issue.type]} ${
        issue.subType
      }`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: targetPath,
            uriBaseId: PROJECT_ROOT_KEY,
          },
          region: {
            startLine: issue.lineNumber,
          },
        },
      },
    ],
  }));
}
