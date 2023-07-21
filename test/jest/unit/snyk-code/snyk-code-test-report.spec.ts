import * as path from 'path';
import { analyzeFolders, analyzeScmProject } from '@snyk/code-client';

import { loadJson } from '../../../utils';
import { ArgsOptions } from '../../../../src/cli/args';
import snykTest from '../../../../src/cli/commands/test';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as checks from '../../../../src/lib/plugins/sast/checks';
import * as analysis from '../../../../src/lib/plugins/sast/analysis';

const { getCodeTestResults } = analysis;

jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;
const analyzeScmProjectMock = analyzeScmProject as jest.Mock;

describe('Test snyk code with --report', () => {
  let isSastEnabledForOrgSpy;
  let trackUsageSpy;
  let getCodeTestResultsSpy;

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
  const sampleAnalyzeScmProjectResponse = loadJson(
    path.join(fixturePath, 'sample-analyze-scm-project-response.json'),
  );

  const sastSettings = {
    sastEnabled: true,
    localCodeEngine: {
      url: '',
      allowCloudUpload: true,
      enabled: false,
    },
  };

  beforeAll(() => {
    isSastEnabledForOrgSpy = jest.spyOn(checks, 'getSastSettingsForOrg');
    trackUsageSpy = jest.spyOn(checks, 'trackUsage');
    getCodeTestResultsSpy = jest.spyOn(analysis, 'getCodeTestResults');
  });

  beforeEach(() => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('file-based report flow - analyzeFolders', () => {
    it('should return the right report results response', async () => {
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
          analysisContext: expect.objectContaining({
            flow: 'snyk-cli',
            initiator: 'CLI',
            project: {
              name: reportOptions.projectName,
              publicId: 'unknown',
              type: 'sast',
            },
          }),
        }),
      );

      const expectedReportResults = {
        projectId: 'test-project-id',
        snapshotId: 'test-snapshot-id',
        reportUrl: 'test/report/url',
      };

      expect(actual?.reportResults).toEqual(expectedReportResults);
    });
  });

  describe('SCM-based report flow - analyzeScmProject', () => {
    it('should return the right report results response', async () => {
      const reportOptions = {
        projectId: 'test-scm-project-id',
        commitId: 'test-commit-id',
      };

      analyzeScmProjectMock.mockResolvedValue(sampleAnalyzeScmProjectResponse);

      const actual = await getCodeTestResults(
        '.',
        {
          path: '',
          code: true,
          report: true,
          'project-id': reportOptions.projectId,
          'commit-id': reportOptions.commitId,
        },
        sastSettings,
        'test-id',
      );

      expect(analyzeScmProjectMock).toHaveBeenCalledWith(
        expect.objectContaining({
          reportOptions,
          analysisContext: expect.objectContaining({
            flow: 'snyk-cli',
            initiator: 'CLI',
            project: {
              name: 'unknown',
              publicId: reportOptions.projectId,
              type: 'sast',
            },
          }),
        }),
      );

      const expectedReportResults = {
        projectId: 'test-scm-project-id',
        snapshotId: 'test-scm-snapshot-id',
        reportUrl: 'test/scm/report/url',
      };

      expect(actual?.reportResults).toEqual(expectedReportResults);
    });
  });

  describe('exit codes', () => {
    it('should exit with correct code (1) when issues are found (including ignored issues)', async () => {
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

      getCodeTestResultsSpy.mockResolvedValue(
        sampleAnalyzeFoldersWithReportAndIgnoresResponse,
      );

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

      getCodeTestResultsSpy.mockResolvedValue(
        sampleAnalyzeFoldersWithReportAndIgnoresOnlyResponse,
      );

      await expect(snykTest('some/path', options)).resolves.not.toThrowError();
    });
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
        getCodeTestResultsSpy.mockRejectedValue(codeClientError);

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
