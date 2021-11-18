import { createSarifOutputForIac } from '../../../../../src/lib/formatters/iac-output';
import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../../../src/lib/snyk-test/iac-test-result';
import { SEVERITY } from '../../../../../src/lib/snyk-test/legacy';

describe('createSarifOutputForIac', () => {
  function createResponseIssue(
    issueOverrides?: Partial<AnnotatedIacIssue>,
  ): IacTestResponse {
    const issue: AnnotatedIacIssue = {
      id: 'ID',
      title: 'TITLE',
      severity: SEVERITY.HIGH,
      isIgnored: false,
      cloudConfigPath: ['resource', 'something'],
      subType: 'SUBTYPE',
      isGeneratedByCustomRule: false,
      lineNumber: 1,
      iacDescription: {
        issue: 'Description of Issue',
        impact: 'Description of Impact',
        resolve: 'Description of Remediation',
      },
      ...issueOverrides,
    };

    return {
      ok: true,
      org: 'MY_ORG',
      isPrivate: false,
      summary: '',
      path: 'target_file.tf',
      targetFile: 'target_file.tf',
      projectName: 'target_file.tf',
      displayTargetFile: 'target_file.tf',
      foundProjectCount: 0,
      meta: {
        isPublic: false,
        isLicensesEnabled: false,
        policy: '',
        org: 'MY_ORG',
      },
      result: {
        cloudConfigResults: [issue],
        projectType: 'terraformconfig',
      },
    };
  }

  it('includes an artifactLocation and region', () => {
    const issue = createResponseIssue();
    const sarif = createSarifOutputForIac([issue]);

    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).toEqual({
      startLine: 1,
    });
  });

  it('excludes the region if no line number was found', () => {
    const issue = createResponseIssue({ lineNumber: -1 });
    const sarif = createSarifOutputForIac([issue]);

    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).not.toBeDefined();
  });

  it('excludes the region if no line number is present', () => {
    const issue = createResponseIssue({ lineNumber: undefined });
    const sarif = createSarifOutputForIac([issue]);

    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).not.toBeDefined();
  });
});
