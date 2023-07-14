import * as path from 'path';
import { analyzeFolders } from '@snyk/code-client';

import { loadJson } from '../../../utils';
import { ArgsOptions } from '../../../../src/cli/args';
import snykTest from '../../../../src/cli/commands/test';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as checks from '../../../../src/lib/plugins/sast/checks';
import * as analysis from '../../../../src/lib/plugins/sast/analysis';
import { getCodeTestResults } from '../../../../src/lib/plugins/sast/analysis';

jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;

describe('Test snyk code with --report', () => {
  let isSastEnabledForOrgSpy;
  let trackUsageSpy;

  const fixturePath = path.join(__dirname, '../../../fixtures/sast');

  const sampleAnalyzeFoldersWithReportAndIgnoresResponse = loadJson(
    path.join(
      fixturePath,
      'sample-analyze-folders-with-report-and-ignores-response.json',
    ),
  );
  const sampleAnalyzeFoldersWithReportAndIgnoresOnlyResponse = loadJson(
    path.join(
      fixturePath,
      'sample-analyze-folders-with-report-and-ignores-only-response.json',
    ),
  );

  beforeAll(() => {
    isSastEnabledForOrgSpy = jest.spyOn(checks, 'getSastSettingsForOrg');
    trackUsageSpy = jest.spyOn(checks, 'trackUsage');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return the right report results response', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: { url: '', allowCloudUpload: true, enabled: false },
    };

    const reportOptions = {
      enabled: true,
      projectName: 'test-project-name',
      targetName: 'test-target-name',
      targetRef: 'test-target-ref',
      remoteRepoUrl: 'https://github.com/owner/repo',
    };

    analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersWithReportAndIgnoresResponse,
    );
    const actual = await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
        report: true,
        'project-name': reportOptions.projectName,
        'target-name': reportOptions.targetName,
        'target-reference': reportOptions.targetRef,
        'remote-repo-url': reportOptions.remoteRepoUrl,
      },
      sastSettings,
      'test-id',
    );

    expect(analyzeFoldersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reportOptions,
      }),
    );

    const expectedReportResults = {
      projectId: 'test-project-id',
      snapshotId: 'test-snapshot-id',
      reportUrl: 'test/report/url',
    };

    expect(actual?.reportResults).toEqual(expectedReportResults);
  });

  it('should create sarif result including suppressions (ignored issues)', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: { url: '', allowCloudUpload: true, enabled: false },
    };

    // First get results without ignores - it should not ignore when report is disabled
    analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersWithReportAndIgnoresResponse,
    );
    const resultWithoutIgnores = await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
        report: false,
      },
      sastSettings,
      'test-id',
    );

    const sarifWithoutIgnores =
      resultWithoutIgnores?.analysisResults.sarif.runs[0].results;
    if (!sarifWithoutIgnores) throw new Error('A value was expected');

    // Then get the results with ignores - ignore when report is enabled
    analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersWithReportAndIgnoresResponse,
    );
    const resultWithIgnores = await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
        report: true,
      },
      sastSettings,
      'test-id',
    );

    const sarifWithIgnores =
      resultWithIgnores?.analysisResults.sarif.runs[0].results;
    if (!sarifWithIgnores) throw new Error('A value was expected');

    expect(sarifWithoutIgnores.length).toBeGreaterThan(0);
    expect(sarifWithIgnores.length).toBeGreaterThan(0);
    expect(sarifWithIgnores.length).toBe(sarifWithoutIgnores.length);

    let numSuppressions = 0;
    sarifWithIgnores.forEach((result) => {
      numSuppressions += result.suppressions?.length ?? 0;
    });
    expect(numSuppressions).toBeGreaterThan(0);
  });

  it('should exit with correct code (1) when ignored issues are found', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      report: true,
      projectName: 'test-project',
      _: [],
      _doubleDashArgs: [],
    };

    analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersWithReportAndIgnoresResponse,
    );
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    await expect(snykTest('some/path', options)).rejects.toThrowError();
  });

  it('should exit with correct code (0) when only ignored issues are found', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      report: true,
      projectName: 'test-project',
      _: [],
      _doubleDashArgs: [],
    };

    analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersWithReportAndIgnoresOnlyResponse,
    );
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    await expect(snykTest('some/path', options)).resolves.not.toThrowError();
  });

  describe('error handling', () => {
    it.each([
      [
        'disabled FF',
        {
          apiName: 'initReport',
          statusCode: 400,
          statusText: 'Bad request',
        },
        'Make sure this feature is enabled by contacting support.',
      ],
      [
        'SARIF too large',
        {
          apiName: 'getReport',
          statusCode: 400,
          statusText: 'Analysis result set too large',
        },
        'The findings for this project may exceed the allowed size limit.',
      ],
      [
        'analysis failed',
        {
          apiName: 'getReport',
          statusCode: 500,
          statusText: 'Analysis failed',
        },
        "One or more of Snyk's services may be temporarily unavailable.",
      ],
      [
        'bad gateway',
        {
          apiName: 'initReport',
          statusCode: 502,
          statusText: 'Bad Gateway',
        },
        "One or more of Snyk's services may be temporarily unavailable.",
      ],
    ])(
      'when code-client fails, throw customized message for %s',
      async (_, codeClientError, expectedErrorUserMessage) => {
        jest
          .spyOn(analysis, 'getCodeTestResults')
          .mockRejectedValue(codeClientError);

        isSastEnabledForOrgSpy.mockResolvedValueOnce({
          sastEnabled: true,
          localCodeEngine: {
            enabled: false,
          },
        });
        trackUsageSpy.mockResolvedValue({});

        await expect(
          ecosystems.testEcosystem('code', ['.'], {
            path: '',
            code: true,
            report: true,
          }),
        ).rejects.toHaveProperty(
          'userMessage',
          expect.stringContaining(expectedErrorUserMessage),
        );
      },
    );
  });
});
