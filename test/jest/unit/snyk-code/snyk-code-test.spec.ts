import * as fs from 'fs';
import * as path from 'path';
import stripAnsi from 'strip-ansi';
import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;

import { loadJson } from '../../../utils';
import config from '../../../../src/lib/config';
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
import osName = require('os-name');

describe('Test snyk code', () => {
  let apiUserConfig;
  let isSastEnabledForOrgSpy;
  let trackUsageSpy;
  const failedCodeTestMessage = "Failed to run 'code test'";
  const fakeApiKey = '123456789';
  const baseURL = config.CODE_CLIENT_PROXY_URL;
  const LCEbaseURL = 'https://my-proxy-server';
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
      localCodeEngine: {
        enabled: false,
      },
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
      localCodeEngine: {
        enabled: false,
      },
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
      rawArgv: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
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
        rawArgv: [],
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it('should show error if sast is not enabled', async () => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: false,
      localCodeEngine: {
        enabled: false,
      },
    });

    await expect(
      snykTest('some/path', {
        code: true,
        _: [],
        _doubleDashArgs: [],
        rawArgv: [],
      }),
    ).rejects.toHaveProperty(
      'userMessage',
      'Snyk Code is not supported for org: enable in Settings > Snyk Code',
    );
  });

  it('should show org not found error according to response from api', async () => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      code: 404,
      userMessage: 'error from api: org not found',
    });

    await expect(
      snykTest('some/path', {
        code: true,
        _: [],
        _doubleDashArgs: [],
        rawArgv: [],
      }),
    ).rejects.toHaveProperty('userMessage', 'error from api: org not found');
  });

  it('should show error if limit is reached', async () => {
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValueOnce({
      code: 429,
      userMessage: 'Test limit reached!',
    });

    await expect(
      snykTest('some/path', {
        code: true,
        _: [],
        _doubleDashArgs: [],
        rawArgv: [],
      }),
    ).rejects.toHaveProperty('userMessage', 'Test limit reached!');
  });

  it('should create sarif result when `--sarif-file-output` is used', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      _: [],
      _doubleDashArgs: [],
      'sarif-file-output': 'test.json',
      rawArgv: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await snykTest('some/path', options);
    } catch (error) {
      // check if stringified sarif result exists
      expect(error.sarifStringifiedResults).toBeTruthy();

      const errSarifResult = error.sarifStringifiedResults.trim();
      const expectedSarifOutput = jsonStringifyLargeObject(
        sampleSarifResponse,
      ).trim();
      const errMessage = stripAscii(stripAnsi(error.message.trim()));
      const expectedOutput = stripAscii(stripAnsi(testOutput.trim()));

      // check if error code and message is correct and sarif result is as expected
      expect(error.code).toBe('VULNS');
      expect(errMessage).toBe(expectedOutput);
      expect(errSarifResult).toBe(expectedSarifOutput);
    }
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
        localCodeEngine: {
          enabled: false,
        },
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
      rawArgv: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
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

  it('succeed testing with correct exit code - with sarif output and no markdown', async () => {
    const sampleSarif = loadJson(
      path.join(
        __dirname,
        '/../../../fixtures/sast/sample-analyze-folders-response.json',
      ),
    );
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      sarif: true,
      _: [],
      _doubleDashArgs: [],
      'no-markdown': true,
      rawArgv: [],
    };

    analyzeFoldersMock.mockResolvedValue(sampleSarif);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await snykTest('some/path', options);
    } catch (error) {
      const errMessage = error.message.trim();
      expect(error.code).toBe('VULNS');
      const output = JSON.parse(errMessage);
      expect(Object.keys(output.runs[0].results[0].message)).not.toContain(
        'markdown',
      );
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
      localCodeEngine: {
        enabled: false,
      },
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
        localCodeEngine: {
          enabled: false,
        },
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

  it('When code-client fails, generalizes message for non-auth failures', async () => {
    const codeClientError = {
      apiName: 'extendBundle',
      statusCode: 421,
      statusText: '[Connection issue] Connection refused',
    };

    jest
      .spyOn(analysis, 'getCodeAnalysisAndParseResults')
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
      }),
    ).rejects.toHaveProperty('message', "Failed to run 'code test'");
  });

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
      analysisContext: {
        flow: 'snyk-cli',
        initiator: 'CLI',
      },
    };

    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: { url: '', allowCloudUpload: true, enabled: false },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeAnalysisAndParseResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
    );

    expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
  });

  it('analyzeFolders should return the right sarif response', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: { url: '', allowCloudUpload: true, enabled: false },
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    const actual = await getCodeAnalysisAndParseResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
    );

    expect(actual).toEqual(sampleSarifResponse);
  });

  it.each([
    [
      "use LCE's url as base when LCE is enabled",
      LCEbaseURL,
      {
        sastEnabled: true,
        localCodeEngine: {
          url: LCEbaseURL,
          allowCloudUpload: false,
          enabled: true,
        },
      },
    ],
    [
      "use cloud solution when LCE's feature is not enabled",
      baseURL,
      {
        sastEnabled: true,
        localCodeEngine: {
          url: LCEbaseURL,
          allowCloudUpload: true,
          enabled: false,
        },
      },
    ],
  ])(
    'Local code engine - analyzeFolders should %s',
    async (msg, url, sastSettings) => {
      const sessionToken = expect.any(String);
      const source = expect.any(String);
      const severity = AnalysisSeverity.info;
      const paths: string[] = ['.'];

      const codeAnalysisArgs = {
        connection: {
          baseURL: url,
          sessionToken,
          source,
        },
        analysisOptions: {
          severity,
        },
        fileOptions: { paths },
        analysisContext: {
          flow: 'snyk-cli',
          initiator: 'CLI',
        },
      };

      const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
        sampleAnalyzeFoldersResponse,
      );
      await getCodeAnalysisAndParseResults(
        '.',
        {
          path: '',
          code: true,
        },
        sastSettings,
      );

      expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
    },
  );

  it('Local Code Engine - Always calls code-client with url coming from sastSettings', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: 'http://lce:31111/api',
        allowCloudUpload: false,
        enabled: true,
      },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeAnalysisAndParseResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
    );

    expect(analyzeFoldersSpy.mock.calls[0][0].connection.baseURL).toBe(
      'http://lce:31111/api',
    );
  });

  it('Local code engine - should throw error, when enabled and url is missing', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: { url: '', allowCloudUpload: true, enabled: true },
    };

    await expect(
      getCodeAnalysisAndParseResults(
        '.',
        {
          path: '',
          code: true,
        },
        sastSettings,
      ),
    ).rejects.toThrowError(
      'Missing configuration for Snyk Code Local Engine. Refer to our docs to learn more: https://docs.snyk.io/products/snyk-code/deployment-options/snyk-code-local-engine/cli-and-ide',
    );
  });
});

function stripAscii(asciiStr) {
  return asciiStr.replace(/[^ -~]+/g, '').trim();
}
