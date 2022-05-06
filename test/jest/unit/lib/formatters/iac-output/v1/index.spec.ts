import {
  createSarifOutputForIac,
  shareResultsOutput,
} from '../../../../../../../src/lib/formatters/iac-output';
import * as iacOutputUtils from '../../../../../../../src/lib/formatters/iac-output/v1/utils';
import {
  IacTestResponse,
  AnnotatedIacIssue,
} from '../../../../../../../src/lib/snyk-test/iac-test-result';
import { SEVERITY } from '../../../../../../../src/lib/snyk-test/legacy';

describe('createSarifOutputForIac', () => {
  function createResponseIssue(
    severity = SEVERITY.HIGH,
    issueOverrides?: Partial<AnnotatedIacIssue>,
  ): IacTestResponse {
    const issue: AnnotatedIacIssue = {
      id: 'ID',
      title: 'TITLE',
      severity,
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

  it('treats a high severity issue as an error', () => {
    const issue = createResponseIssue(SEVERITY.HIGH);
    const sarif = createSarifOutputForIac([issue]);

    const issueLevel =
      sarif.runs?.[0]?.tool?.driver?.rules?.[0]?.defaultConfiguration?.level;
    expect(issueLevel).toEqual('error');
  });

  it('treats a critical severity issue as an error', () => {
    const issue = createResponseIssue(SEVERITY.CRITICAL);
    const sarif = createSarifOutputForIac([issue]);

    const issueLevel =
      sarif.runs?.[0]?.tool?.driver?.rules?.[0]?.defaultConfiguration?.level;
    expect(issueLevel).toEqual('error');
  });

  it('includes an artifactLocation and region', () => {
    const issue = createResponseIssue(SEVERITY.HIGH);
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
    const issue = createResponseIssue(SEVERITY.HIGH, { lineNumber: -1 });
    const sarif = createSarifOutputForIac([issue]);

    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).not.toBeDefined();
  });

  it('excludes the region if no line number is present', () => {
    const issue = createResponseIssue(SEVERITY.HIGH, { lineNumber: undefined });
    const sarif = createSarifOutputForIac([issue]);

    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).not.toBeDefined();
  });

  it('uses the base path if git not present', () => {
    const getRepoRootSpy = jest.spyOn(iacOutputUtils, 'getRepoRoot');
    getRepoRootSpy.mockImplementation(() => {
      throw new Error();
    });

    const issue = createResponseIssue(SEVERITY.HIGH, { lineNumber: undefined });
    const sarif = createSarifOutputForIac([issue]);

    expect(
      sarif.runs?.[0]?.originalUriBaseIds?.PROJECTROOT?.uri?.endsWith('snyk/'),
    ).toBeTruthy();
    const location = sarif.runs?.[0]?.results?.[0]?.locations?.[0];
    expect(location?.physicalLocation?.artifactLocation).toEqual({
      uri: 'target_file.tf',
      uriBaseId: 'PROJECTROOT',
    });
    expect(location?.physicalLocation?.region).not.toBeDefined();
  });
});

describe('shareResultsOutput', () => {
  it('returns the correct output when gitRemoteUrl is specified', () => {
    const output = shareResultsOutput({
      projectName: 'test-project',
      orgName: 'test-org',
      gitRemoteUrl: 'http://github.com/test/repo.git',
    });

    expect(output).toContain('under the name test/repo');
  });
  it('returns the correct output when gitRemoteUrl is not specified', () => {
    const output = shareResultsOutput({
      projectName: 'test-project',
      orgName: 'test-org',
    });

    expect(output).toContain('under the name test-project');
  });
});
