import * as fs from 'fs';
import * as path from 'path';
import stripAnsi = require('strip-ansi');
import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;

import { loadJson } from '../../../utils';
import * as checks from '../../../../src/lib/plugins/sast/checks';
import { config as userConfig } from '../../../../src/lib/user-config';
import * as analysis from '../../../../src/lib/plugins/sast/analysis';
import { Options, TestOptions } from '../../../../src/lib/types';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as analytics from '../../../../src/lib/analytics';
import snykTest from '../../../../src/cli/commands/test/';
import { jsonStringifyLargeObject } from '../../../../src/lib/json';
import { ArgsOptions } from '../../../../src/cli/args';

const { getCodeAnalysisAndParseResults } = analysis;
const osName = require('os-name');

describe('Test snyk code', () => {
  let apiUserConfig;
  let isSastEnabledForOrgSpy;
  let trackUsageSpy;
  const failedCodeTestMessage = "Failed to run 'code test'";
  const fakeApiKey = '123456789';
  const sampleSarifResponse = loadJson(
    path.join(__dirname, '/../../../fixtures/sast/sample-sarif.json'),
  );
  const sampleAnalyzeFoldersResponse = loadJson(
    path.join(
      __dirname,
      '/../../../fixtures/sast/sample-analyze-folders-response.json',
    ),
  );

  const isWindows =
    osName()
      .toLowerCase()
      .indexOf('windows') === 0;
  const fixturePath = path.join(__dirname, '../../../fixtures', 'sast');
  const cwd = process.cwd();

  function readFixture(filename: string) {
    if (isWindows) {
      filename = filename.replace('.txt', '-windows.txt');
    }
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }
  const testOutput = readFixture('test-output.txt');

  beforeAll(() => {
    process.chdir(fixturePath);
    apiUserConfig = userConfig.get('api');
    userConfig.set('api', fakeApiKey);
    isSastEnabledForOrgSpy = jest.spyOn(checks, 'getSastSettingsForOrg');
    trackUsageSpy = jest.spyOn(checks, 'trackUsage');
  });

  afterAll(() => {
    userConfig.set('api', apiUserConfig);
    process.chdir(cwd);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should fail if auth fails', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
    };
    isSastEnabledForOrgSpy.mockResolvedValueOnce({ code: 401 });
    trackUsageSpy.mockResolvedValue({});

    await expect(
      ecosystems.testEcosystem('code', ['some/path'], {
        code: true,
        ...options,
      }),
    ).rejects.toThrowError(
      /Authentication failed. Please check the API token on/,
    );
  });

  it('should fail - when we do not support files', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
    };

    analyzeFoldersMock.mockResolvedValue(null);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
    });
    trackUsageSpy.mockResolvedValue({});

    expect.hasAssertions();
    try {
      await ecosystems.testEcosystem('code', ['some/path'], options);
    } catch (error) {
      const errMessage = stripAscii(stripAnsi(error.message.trim()));

      expect(error.code).toBe(422);
      expect(errMessage).toContain('We found 0 supported files');
    }
  });

  it('succeed testing - with correct exit code', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
    });
    trackUsageSpy.mockResolvedValue({});

    expect.hasAssertions();
    try {
      await ecosystems.testEcosystem('code', ['some/path'], options);
    } catch (error) {
      const errMessage = stripAscii(stripAnsi(error.message.trim()));
      const expectedOutput = stripAscii(stripAnsi(testOutput.trim()));

      // exit code 1
      expect(error.code).toBe('VULNS');
      expect(errMessage).toBe(expectedOutput);
    }
  });

  it('should succeed testing from the cli test command - with correct exit code', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      _: [],
      _doubleDashArgs: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
    });
    trackUsageSpy.mockResolvedValue({});

    expect.hasAssertions();
    try {
      await snykTest('some/path', options);
    } catch (error) {
      const errMessage = stripAscii(stripAnsi(error.message.trim()));
      const expectedOutput = stripAscii(stripAnsi(testOutput.trim()));

      // exit code 1
      expect(error.code).toBe('VULNS');
      expect(errMessage).toBe(expectedOutput);
    }
  });

  it('should throw error when response code is not 200', async () => {
    const error = { code: 401, message: 'Invalid auth token' };
    isSastEnabledForOrgSpy.mockRejectedValue(error);

    const expected = new Error(error.message);
    expect.hasAssertions();
    try {
      await ecosystems.testEcosystem('code', ['.'], {
        path: '',
        code: true,
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it('should throw error correctly from outside of ecosystem flow when response code is not 200', async () => {
    const error = { code: 401, message: 'Invalid auth token' };
    isSastEnabledForOrgSpy.mockRejectedValue(error);

    const expected = new Error(error.message);
    expect.hasAssertions();
    try {
      await snykTest('.', {
        path: '',
        code: true,
        _: [],
        _doubleDashArgs: [],
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it('should show error if sast is not enabled', async () => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({ sastEnabled: false });

    await expect(
      snykTest('some/path', { code: true, _: [], _doubleDashArgs: [] }),
    ).rejects.toHaveProperty(
      'userMessage',
      'Snyk Code is not supported for org: enable in Settings > Snyk Code',
    );
  });

  it('should show error if limit is reached', async () => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({ sastEnabled: true });
    trackUsageSpy.mockResolvedValueOnce({
      code: 429,
      userMessage: 'Test limit reached!',
    });

    await expect(
      snykTest('some/path', { code: true, _: [], _doubleDashArgs: [] }),
    ).rejects.toHaveProperty('userMessage', 'Test limit reached!');
  });

  it.each([
    ['sarif', { sarif: true }],
    ['json', { json: true }],
  ])(
    'succeed testing with correct exit code - with %p output',
    async (optionsName, optionsObject) => {
      const options: Options & TestOptions = {
        path: '',
        traverseNodeModules: false,
        showVulnPaths: 'none',
        code: true,
        ...optionsObject,
      };

      analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
      isSastEnabledForOrgSpy.mockResolvedValueOnce({
        sastEnabled: true,
      });
      trackUsageSpy.mockResolvedValue({});

      expect.hasAssertions();
      try {
        await ecosystems.testEcosystem('code', ['some/path'], options);
      } catch (error) {
        const errMessage = error.message.trim();
        const expectedOutput = jsonStringifyLargeObject(
          sampleSarifResponse,
        ).trim();

        // exit code 1
        expect(error.code).toBe('VULNS');
        expect(errMessage).toBe(expectedOutput);
      }
    },
  );

  it('succeed testing with correct exit code - with sarif output', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      sarif: true,
      _: [],
      _doubleDashArgs: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await snykTest('some/path', options);
    } catch (error) {
      const errMessage = error.message.trim();
      const expectedOutput = jsonStringifyLargeObject(
        sampleSarifResponse,
      ).trim();

      // exit code 1
      expect(error.code).toBe('VULNS');
      expect(errMessage).toBe(expectedOutput);
    }
  });

  it('succeed testing with correct exit code - and analytics added', async () => {
    const analyticSend = jest.spyOn(analytics, 'add');

    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await ecosystems.testEcosystem('code', ['some/path'], options);
    } catch (error) {
      const errMessage = stripAscii(stripAnsi(error.message.trim()));
      const expectedOutput = stripAscii(stripAnsi(testOutput.trim()));

      // exit code 1
      expect(error.code).toBe('VULNS');
      expect(errMessage).toBe(expectedOutput);
      expect(analyticSend).toBeCalledTimes(2);
    }
  });

  it.each([
    [{ code: 401 }, `Unauthorized: ${failedCodeTestMessage}`],
    [{ code: 500 }, failedCodeTestMessage],
  ])(
    'given %p argument, we fail with error message %p',
    async (errorCodeObj, expectedResult) => {
      const codeClientError = {
        statusCode: errorCodeObj.code,
        statusText: 'Unauthorized action',
        apiName: '/some-api',
      };
      jest
        .spyOn(analysis, 'getCodeAnalysisAndParseResults')
        .mockRejectedValue(codeClientError);
      isSastEnabledForOrgSpy.mockResolvedValueOnce({
        sastEnabled: true,
      });
      trackUsageSpy.mockResolvedValue({});

      await expect(
        ecosystems.testEcosystem('code', ['.'], {
          path: '',
          code: true,
        }),
      ).rejects.toHaveProperty('message', expectedResult);
    },
  );

  it('analyzeFolders should be called with the right arguments', async () => {
    const baseURL = expect.any(String);
    const sessionToken = expect.any(String);
    const source = expect.any(String);
    const severity = AnalysisSeverity.info;
    const paths: string[] = ['.'];

    const codeAnalysisArgs = {
      connection: {
        baseURL,
        sessionToken,
        source,
      },
      analysisOptions: {
        severity,
      },
      fileOptions: { paths },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeAnalysisAndParseResults('.', {
      path: '',
      code: true,
    });

    expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
  });

  it('analyzeFolders should should return the right sarif response', async () => {
    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    const actual = await getCodeAnalysisAndParseResults('.', {
      path: '',
      code: true,
    });

    expect(actual).toEqual(sampleSarifResponse);
  });
});

function stripAscii(asciiStr) {
  return asciiStr.replace(/[^ -~]+/g, '').trim();
}
