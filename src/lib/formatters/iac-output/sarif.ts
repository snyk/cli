import * as pathLib from 'path';
import { pathToFileURL } from 'url';
import * as upperFirst from 'lodash.upperfirst';
import * as camelCase from 'lodash.camelcase';

import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../snyk-test/iac-test-result';
import * as sarif from 'sarif';
import { isLocalFolder } from '../../detect';
import { getIssueLevel } from '../sarif-output';
import { getVersion } from '../../version';
import { getRepositoryRoot } from '../../iac/git';

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
    repoRoot = getRepositoryRoot() + '/';
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
        automationDetails : getAutomationDetails(pathToFileURL(repoRoot).href),
        results: mapIacTestResponseToSarifResults(issues),
      },
    ],
  };
}

function extractReportingDescriptor(
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

// Github anncouned changes to their SARIF upload -- https://github.blog/changelog/2024-05-06-code-scanning-will-stop-combining-runs-from-a-single-upload/
// the impact is when a SARIF that is being uploaded, each run must have unique category, as defined by GitHub here, https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning#runautomationdetails-object
// This presents a new problem of when a file is removed from source since GH will not have an empty result to close any previously opened items since GH open/closes
// based on the SARIF tool.driver.name + Category. Open source's solution is the most obvious, inlcude the targetFile. Snyk-iac, is using this field set to a static "snyk-iac". Combing what
// was being done there with the file name to generate the unique value. Using | as a separator to make it easier to parse out tool vs targetFile. 
function getAutomationDetails(path: string)
{
  let automationId = !!process.env.SET_AUTOMATION_DETAILS_ID ? `snyk-iac|${path}/` : "snyk-iac"
  return {
    id : automationId,
  };
}

function mapIacTestResponseToSarifResults(
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
