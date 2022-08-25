import { pathToFileURL } from 'url';
import { marked } from 'marked';
import * as sarif from 'sarif';
import * as path from 'path';
import * as upperFirst from 'lodash.upperfirst';
import * as camelCase from 'lodash.camelcase';

import { getVersion } from '../../../version';
import { Results, TestOutput } from './scan/results';
import { getIssueLevel } from '../../../formatters/sarif-output';
import { getRepositoryRoot } from '../../git';

// Used to reference the base path in results.
const PROJECT_ROOT_KEY = 'PROJECTROOT';

export function convertEngineToSarifResults(scanResult: TestOutput): sarif.Log {
  let repoRoot;
  try {
    repoRoot = getRepositoryRoot() + '/';
  } catch {
    repoRoot = path.join(process.cwd(), '/'); // the slash at the end is required, otherwise the artifactLocation.uri starts with a slash
  }
  const tool: sarif.Tool = {
    driver: {
      name: 'Snyk IaC',
      fullName: 'Snyk Infrastructure as Code',
      version: getVersion(),
      informationUri:
        'https://docs.snyk.io/products/snyk-infrastructure-as-code',
      rules: extractReportingDescriptor(scanResult.results),
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
        results: mapSnykIacTestResultsToSarifResults(scanResult.results),
      },
    ],
  };
}

function extractReportingDescriptor(
  results: Results | undefined,
): sarif.ReportingDescriptor[] {
  const rules: Record<string, sarif.ReportingDescriptor> = {};

  if (!results?.vulnerabilities) {
    return Object.values(rules);
  }

  results.vulnerabilities.forEach((vulnerability) => {
    if (rules[vulnerability.rule.id]) {
      return;
    }

    const tags = ['security']; // switch to rules.labels once `snyk-iac-test` includes this info

    rules[vulnerability.rule.id] = {
      id: vulnerability.rule.id,
      name: upperFirst(camelCase(vulnerability.rule.title)).replace(/ /g, ''),
      shortDescription: {
        text: `${upperFirst(vulnerability.severity)} severity - ${
          vulnerability.rule.title
        }`,
      },
      fullDescription: {
        text: vulnerability.rule.description,
      },
      help: {
        text: renderMarkdown(vulnerability.remediation),
        markdown: vulnerability.remediation,
      },
      defaultConfiguration: {
        level: getIssueLevel(vulnerability.severity),
      },
      properties: {
        tags,
        problem: {
          severity: vulnerability.severity,
        },
      },
      helpUri: vulnerability.rule.documentation,
    };
  });
  return Object.values(rules);
}

function renderMarkdown(markdown: string) {
  const renderer = {
    em(text) {
      return text;
    },
    strong(text) {
      return text;
    },
    link(text) {
      return text;
    },
    blockquote(quote) {
      return quote;
    },
    list(body) {
      return body;
    },
    listitem(text) {
      return text;
    },
    paragraph(text) {
      return text;
    },
    codespan(text) {
      return text;
    },
    code(code) {
      return code;
    },
    heading(text) {
      return `${text}\n`;
    },
  };

  marked.use({ renderer });
  return marked.parse(markdown);
}

function mapSnykIacTestResultsToSarifResults(
  results: Results | undefined,
): sarif.Result[] {
  const result: sarif.Result[] = [];

  if (!results?.vulnerabilities) {
    return result;
  }

  results.vulnerabilities.forEach((vulnerability) => {
    result.push({
      ruleId: vulnerability.rule.id,
      message: {
        text: `This line contains a potential ${vulnerability.severity} severity misconfiguration`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: vulnerability.resource.file,
              uriBaseId: PROJECT_ROOT_KEY,
            },
            // We exclude the `region` key when the line number is missing or -1.
            // https://docs.oasis-open.org/sarif/sarif/v2.0/csprd02/sarif-v2.0-csprd02.html#_Toc10127873
            region: {
              startLine: vulnerability.resource.line ?? 1,
            },
          },
        },
      ],
    });
  });

  return result;
}
