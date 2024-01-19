import * as sarif from 'sarif';
import * as groupBy from 'lodash.groupby';
import * as map from 'lodash.map';

import { SEVERITY, TestResult, AnnotatedIssue } from '../snyk-test/legacy';

export function getResults(testResult: TestResult): sarif.Result[] {
  const groupedVulnerabilities = groupBy(testResult.vulnerabilities, 'id');
  return map(
    groupedVulnerabilities,
    ([vuln]: AnnotatedIssue[]): sarif.Result => ({
      ruleId: vuln.id,
      level: getLevel(vuln),
      message: {
        text: `This file introduces a vulnerable ${vuln.packageName} package with a ${vuln.severity} severity vulnerability.`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: getArtifactLocationUri(
                testResult.displayTargetFile,
                testResult.path,
              ),
            },
            region: {
              startLine: vuln.lineNumber || 1,
            },
          },
          logicalLocations: [
            {
              fullyQualifiedName: `${vuln.packageName}@${vuln.version}`,
            },
          ],
        },
      ],
      fixes:
        vuln.upgradePath?.length >= 2
          ? [
              {
                description: {
                  text: `Upgrade to ${vuln.upgradePath[1]}`,
                },
                artifactChanges: [
                  {
                    artifactLocation: {
                      uri: getArtifactLocationUri(
                        testResult.displayTargetFile,
                        testResult.path,
                      ),
                    },
                    replacements: [
                      {
                        deletedRegion: {
                          startLine: vuln.lineNumber || 1,
                        },
                        insertedContent: {
                          text: vuln.upgradePath[1] as string,
                        },
                      },
                    ],
                  },
                ],
              },
            ]
          : undefined,
    }),
  );
}

export function getLevel(vuln: AnnotatedIssue) {
  switch (vuln.severity) {
    case SEVERITY.CRITICAL:
    case SEVERITY.HIGH:
      return 'error';
    case SEVERITY.MEDIUM:
      return 'warning';
    case SEVERITY.LOW:
    default:
      return 'note';
  }
}

function getArtifactLocationUri(
  targetFile: string | undefined,
  path: string | undefined,
): string {
  if (targetFile) {
    return targetFile;
  }

  // For container tests there might be cases when the target file (i.e. Dockerfile passed with the --file flag) is not
  // present. In this case we use the test result path which contains the image reference (e.g. alpine:3.18.0).
  // Also, Github Code Scanning returns an error when the artifact location uri from the uploaded sarif file contains
  // a colon (e.g. alpine:3.18.0 is not valid, but alpine_3.18.0 is valid), so we are replacing colon characters.
  return path ? path.replace(/:/g, '_') : '';
}
