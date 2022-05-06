import chalk from 'chalk';
import { icon } from '../../../theme';
import * as Debug from 'debug';
import * as pathLib from 'path';
import { pathToFileURL } from 'url';
import upperFirst = require('lodash.upperfirst');
import camelCase = require('lodash.camelcase');

import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../../lib/snyk-test/iac-test-result';
import { printPath } from '../../remediation-based-format-issues';
import { titleCaseText } from '../../legacy-format-issue';
import * as sarif from 'sarif';
import { colorTextBySeverity } from '../../../../lib/snyk-test/common';
import { IacFileInDirectory, IacOutputMeta } from '../../../../lib/types';
import { isLocalFolder } from '../../../../lib/detect';
import { getSeverityValue } from '../../get-severity-value';
import { getIssueLevel } from '../../sarif-output';
import { getVersion } from '../../../version';
import config from '../../../config';
import { getRepoRoot } from './utils';
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
    const pathStr = printPath(path, 0);
    introducedBy = `\n    introduced by ${pathStr}`;
  }

  return (
    colorTextBySeverity(
      issue.severity,
      `  ${icon.ISSUE} ${chalk.bold(issue.title)}${newBadge} [${titleCaseText(
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
    case 'armconfig': {
      return 'ARM';
    }
    default: {
      return 'Infrastructure as Code';
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
  let repoRoot: string;
  try {
    repoRoot = getRepoRoot();
  } catch {
    repoRoot = pathLib.join(basePath, '/'); // the slash at the end is required, otherwise the artifactLocation.uri starts with a slash
  }
  const issues = iacTestResponses.reduce((collect: ResponseIssues, res) => {
    if (res.result) {
      // targetFile is the computed relative path of the scanned file
      // so needs to be cleaned up before assigning to the URI
      const targetPath = getPathRelativeToRepoRoot(
        repoRoot,
        basePath,
        res.targetFile,
      );
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
      name: 'Snyk IaC',
      fullName: 'Snyk Infrastructure as Code',
      version: getVersion(),
      informationUri:
        'https://docs.snyk.io/products/snyk-infrastructure-as-code',
      rules: extractReportingDescriptor(issues),
    },
  };
  return {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        // https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html#_Toc34317498
        originalUriBaseIds: {
          [PROJECT_ROOT_KEY]: {
            uri: pathToFileURL(repoRoot).href,
            description: {
              text: 'The root directory for all project files.',
            },
          },
        },

        tool,
        automationDetails: {
          id: 'snyk-iac',
        },
        results: mapIacTestResponseToSarifResults(issues),
      },
    ],
  };
}

export function extractReportingDescriptor(
  results: ResponseIssues,
): sarif.ReportingDescriptor[] {
  const tool: Record<string, sarif.ReportingDescriptor> = {};

  results.forEach(({ issue }) => {
    if (tool[issue.id]) {
      return;
    }
    // custom rules may not have some of these fields so we check them first
    const fullDescriptionText = issue.subType
      ? `${upperFirst(issue.severity)} severity - ${issue.subType}`
      : `${upperFirst(issue.severity)} severity`;
    const issueText = issue.iacDescription.issue
      ? `The issue is... \n${issue.iacDescription.issue}\n\n`
      : '';
    const issueMarkdown = issue.iacDescription.issue
      ? `**The issue is...** \n${issue.iacDescription.issue}\n\n`
      : '';
    const impactText = issue.iacDescription.impact
      ? ` The impact of this is... \n ${issue.iacDescription.impact}\n\n`
      : '';
    const impactMarkdown = issue.iacDescription.impact
      ? ` **The impact of this is...** \n ${issue.iacDescription.impact}\n\n`
      : '';
    const resolveText = issue.iacDescription.resolve
      ? ` You can resolve this by... \n${issue.iacDescription.resolve}`
      : '';
    const resolveMarkdown = issue.iacDescription.resolve
      ? ` **You can resolve this by...** \n${issue.iacDescription.resolve}`
      : '';
    const tags = ['security'];
    if (issue.subType) {
      tags.push(issue.subType);
    }
    tool[issue.id] = {
      id: issue.id,
      name: upperFirst(camelCase(issue.title)).replace(/ /g, ''),
      shortDescription: {
        text: `${upperFirst(issue.severity)} severity - ${issue.title}`,
      },
      fullDescription: {
        text: fullDescriptionText,
      },
      help: {
        text: `${issueText}${impactText}${resolveText}`.replace(/^\s+/g, ''),
        markdown: `${issueMarkdown}${impactMarkdown}${resolveMarkdown}`.replace(
          /^\s+/g,
          '',
        ),
      },
      defaultConfiguration: {
        level: getIssueLevel(issue.severity),
      },
      properties: {
        tags,
        problem: {
          severity: issue.severity,
        },
      },
      helpUri: issue.documentation,
    };
  });

  return Object.values(tool);
}

export function mapIacTestResponseToSarifResults(
  issues: ResponseIssues,
): sarif.Result[] {
  return issues.map(({ targetPath, issue }) => {
    const hasLineNumber = issue.lineNumber && issue.lineNumber >= 0;
    // custom rules may not have some of these fields so we check them first
    const affectingText = issue.subType
      ? ` affecting the ${issue.subType}`
      : '';
    return {
      ruleId: issue.id,
      message: {
        text: `This line contains a potential ${issue.severity} severity misconfiguration${affectingText}`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: targetPath,
              uriBaseId: PROJECT_ROOT_KEY,
            },
            // We exclude the `region` key when the line number is missing or -1.
            // https://docs.oasis-open.org/sarif/sarif/v2.0/csprd02/sarif-v2.0-csprd02.html#_Toc10127873
            ...(hasLineNumber && {
              region: {
                startLine: issue.lineNumber,
              },
            }),
          },
        },
      ],
    };
  });
}

function getPathRelativeToRepoRoot(
  repoRoot: string,
  basePath: string,
  filePath: string,
) {
  const fullPath = pathLib.resolve(basePath, filePath).replace(/\\/g, '/');
  return fullPath.replace(repoRoot, '');
}

export function shareResultsOutput(iacOutputMeta: IacOutputMeta): string {
  let projectName: string = iacOutputMeta.projectName;
  if (iacOutputMeta?.gitRemoteUrl) {
    // from "http://github.com/snyk/cli.git" to "snyk/cli"
    projectName = iacOutputMeta.gitRemoteUrl.replace(
      /^https?:\/\/github.com\/(.*)\.git$/,
      '$1',
    );
  }
  return `Your test results are available at: ${config.ROOT}/org/${iacOutputMeta.orgName}/projects under the name ${projectName}`;
}
