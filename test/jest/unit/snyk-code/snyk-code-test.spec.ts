import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import stripAnsi = require('strip-ansi');
import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
import { makeRequest } from '../../../../src/lib/request';

jest.mock('@snyk/code-client');
jest.mock('../../../../src/lib/request');

const analyzeFoldersMock = analyzeFolders as jest.Mock;
const makeRequestMock = makeRequest as jest.Mock;

import { loadJson } from '../../../utils';
import * as checks from '../../../../src/lib/plugins/sast/checks';
import { config as userConfig } from '../../../../src/lib/user-config';
import * as analysis from '../../../../src/lib/plugins/sast/analysis';
import { Options, TestOptions } from '../../../../src/lib/types';
import * as ecosystems from '../../../../src/lib/ecosystems';
import * as analytics from '../../../../src/lib/analytics';
import snykTest from '../../../../src/cli/commands/test';
import { jsonStringifyLargeObject } from '../../../../src/lib/json';
import { ArgsOptions } from '../../../../src/cli/args';
import * as codeConfig from '../../../../src/lib/code-config';
import { NeedleResponse } from 'needle';

const { getCodeTestResults } = analysis;

describe('Test snyk code', () => {
  let apiUserConfig;
  let isSastEnabledForOrgSpy;
  let trackUsageSpy;

  const failedCodeTestMessage = "Failed to run 'code test'";
  const fakeApiKey = '123456789';
  const baseURL = codeConfig.getCodeClientProxyUrl();
  const LCEbaseURL = 'https://my-proxy-server';

  const fixturePath = path.join(__dirname, '../../../fixtures/sast');

  const sampleSarifResponse = loadJson(
    path.join(fixturePath, 'sample-sarif.json'),
  );
  const sampleAnalyzeFoldersResponse = loadJson(
    path.join(fixturePath, 'sample-analyze-folders-response.json'),
  );

  const isWindows = os.platform().indexOf('win') === 0;
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
    delete process.env.SNYK_OAUTH_TOKEN;
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

  it('should use oauth token for auth if provided', async () => {
    const oauthToken = 'oauth-token';
    process.env.SNYK_OAUTH_TOKEN = oauthToken;

    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: '',
        allowCloudUpload: true,
        enabled: false,
      },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
      'test-id',
    );

    expect(analyzeFoldersSpy.mock.calls[0][0].connection.sessionToken).toEqual(
      `Bearer ${oauthToken}`,
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
    const error = {
      code: 401,
      message: 'Invalid auth token',
    };
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
    const error = {
      code: 401,
      message: 'Invalid auth token',
    };
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
      }),
    ).rejects.toHaveProperty('userMessage', 'Test limit reached!');
  });

  it.each([
    {
      name: 'should write only sarif result to file when only `--sarif-file-output` is used',
      options: {
        'sarif-file-output': true,
        'json-file-output': false,
      },
    },
    {
      name: 'should write only json result to file when only `--json-file-output` is used',
      options: {
        'sarif-file-output': false,
        'json-file-output': true,
      },
    },
    {
      name: 'should write sarif and json results to file when `--sarif-file-output` and `--json-file-output` are used',
      options: {
        'sarif-file-output': true,
        'json-file-output': true,
      },
    },
  ])('$name', async (args) => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      _: [],
      _doubleDashArgs: [],
      ...args.options,
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    let error: any;
    try {
      await snykTest('some/path', options);
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();

    // Currently json and sarif output are exactly the same, but can be requested independently
    const expectedSarifOutput = args.options['sarif-file-output']
      ? jsonStringifyLargeObject(sampleSarifResponse).trim()
      : undefined;
    const expectedJsonOutput = args.options['json-file-output']
      ? jsonStringifyLargeObject(sampleSarifResponse).trim()
      : undefined;
    const expectedOutput = stripAscii(stripAnsi(testOutput.trim()));

    const errMessage = stripAscii(stripAnsi(error.message.trim()));
    const errSarifResult = error.sarifStringifiedResults?.trim();
    const errJsonResult = error.jsonStringifiedResults?.trim();

    expect(error.code).toStrictEqual('VULNS');
    expect(errMessage).toStrictEqual(expectedOutput);
    expect(errSarifResult).toStrictEqual(expectedSarifOutput);
    expect(errJsonResult).toStrictEqual(expectedJsonOutput);
  });

  it('should create sarif result with security rules mapping', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      _: [],
      _doubleDashArgs: [],
      'sarif-file-output': 'test.json',
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
      const sarifResultsJSON = JSON.parse(error.sarifStringifiedResults.trim());

      const results = sarifResultsJSON.runs[0].results;
      const rules = sarifResultsJSON.runs[0].tool.driver.rules;
      // in each result, look for rule index and make sure it matches in the rules array
      expect(
        results.every((result) => result.ruleId == rules[result.ruleIndex].id),
      ).toBeTruthy();
    }
  });

  describe('Default org test in CLI output', () => {
    beforeAll(() => {
      userConfig.set('org', 'defaultOrg');
    });

    afterAll(() => {
      userConfig.set('org', undefined);
    });

    it('should show the default org in the output when org is not provided', async () => {
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
        localCodeEngine: {
          enabled: false,
        },
        org: 'defaultOrg',
      });
      trackUsageSpy.mockResolvedValue({});

      try {
        await snykTest('some/path', options);
      } catch (error) {
        const errMessage = stripAscii(stripAnsi(error.message.trim()));

        expect(error.code).toBe('VULNS');
        expect(errMessage).toMatch(/Organization:\s+defaultOrg/);
      }
    });

    it('should show the provided org in the output when org is provided', async () => {
      const options: ArgsOptions = {
        path: '',
        traverseNodeModules: false,
        showVulnPaths: 'none',
        code: true,
        _: [],
        _doubleDashArgs: [],
        org: 'otherOrg',
      };

      analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
      isSastEnabledForOrgSpy.mockResolvedValueOnce({
        sastEnabled: true,
        localCodeEngine: {
          enabled: false,
        },
        org: 'defaultOrg',
      });
      trackUsageSpy.mockResolvedValue({});

      try {
        await snykTest('some/path', options);
      } catch (error) {
        const errMessage = stripAscii(stripAnsi(error.message.trim()));

        expect(error.code).toBe('VULNS');
        expect(errMessage).toMatch(/Organization:\s+otherOrg/);
      }
    });
  });

  it('should pass org returned by settings to analysis context', async () => {
    const options: ArgsOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
      code: true,
      _: [],
      _doubleDashArgs: [],
      org: 'anyOrg',
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isSastEnabledForOrgSpy.mockResolvedValueOnce({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
      org: 'defaultOrg',
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await snykTest('some/path', options);
    } catch (error) {
      expect(analyzeFoldersMock).toHaveBeenCalledWith({
        analysisContext: {
          flow: 'snyk-cli',
          initiator: 'CLI',
          projectName: undefined,
          org: {
            displayName: 'unknown',
            flags: {},
            name: 'defaultOrg',
            publicId: 'unknown',
          },
          project: expect.any(Object),
        },
        analysisOptions: expect.any(Object),
        connection: expect.any(Object),
        fileOptions: expect.any(Object),
      });
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
        const expectedOutput =
          jsonStringifyLargeObject(sampleSarifResponse).trim();

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
      localCodeEngine: {
        enabled: false,
      },
    });
    trackUsageSpy.mockResolvedValue({});

    try {
      await snykTest('some/path', options);
    } catch (error) {
      const errMessage = error.message.trim();
      const expectedOutput =
        jsonStringifyLargeObject(sampleSarifResponse).trim();

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
      }),
    ).rejects.toHaveProperty('message', "Failed to run 'code test'");
  });

  it('When code-client fails with details, show message with failure details', async () => {
    const codeClientErrorWithDetail = {
      apiName: 'getAnalysis',
      statusCode: 422,
      statusText: 'Analysis failed',
      detail: 'Analysis failed, more info: https://snyk.io',
    };

    jest
      .spyOn(analysis, 'getCodeTestResults')
      .mockRejectedValue(codeClientErrorWithDetail);

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
    ).rejects.toHaveProperty(
      'userMessage',
      'There was a problem running Code analysis. Analysis failed, more info: https://snyk.io.',
    );
  });

  it('analyzeFolders should be called with the right arguments', async () => {
    const baseURL = expect.any(String);
    const sessionToken = `token ${fakeApiKey}`;
    const source = expect.any(String);
    const severity = AnalysisSeverity.info;
    const paths: string[] = ['.'];

    const codeAnalysisArgs = {
      connection: {
        baseURL,
        sessionToken,
        source,
        requestId: 'test-id',
        orgId: '',
      },
      analysisOptions: {
        severity,
      },
      fileOptions: { paths },
      analysisContext: {
        flow: 'snyk-cli',
        initiator: 'CLI',
        org: expect.any(Object),
        projectName: undefined,
        project: expect.any(Object),
      },
      languages: undefined,
    };

    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: '',
        allowCloudUpload: true,
        enabled: false,
      },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
      'test-id',
    );

    expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
  });

  it('analyzeFolders should return the right sarif response', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: '',
        allowCloudUpload: true,
        enabled: false,
      },
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    const actual = await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
      'test-id',
    );

    expect(actual?.analysisResults.sarif).toEqual(sampleSarifResponse);
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
          requestId: 'test-id',
          orgId: '',
        },
        analysisOptions: {
          severity,
        },
        fileOptions: { paths },
        analysisContext: {
          flow: 'snyk-cli',
          initiator: 'CLI',
          org: expect.any(Object),
          projectName: undefined,
          project: expect.any(Object),
        },
        languages: undefined,
      };

      const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
        sampleAnalyzeFoldersResponse,
      );
      await getCodeTestResults(
        '.',
        {
          path: '',
          code: true,
        },
        sastSettings,
        'test-id',
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
    await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
      },
      sastSettings,
      'test-id',
    );

    expect(analyzeFoldersSpy.mock.calls[0][0].connection.baseURL).toBe(
      'http://lce:31111/api',
    );
  });

  it('Local code engine - makes GET /status to get SCLE version', async () => {
    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: 'http://foo.bar',
        allowCloudUpload: true,
        enabled: true,
      },
    };
    await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
        debug: true,
      },
      sastSettings,
      'test-id',
    );

    const firstArgumentOfMakeRequest = makeRequestMock.mock.calls[0][0];
    expect(firstArgumentOfMakeRequest).toEqual({
      method: 'get',
      url: 'http://foo.bar/status',
    });
  });

  it('Local Code Engine - Scans are not interrupted if /status call fails', async () => {
    // This test `analyzeFolder` if `/status` call throws.

    makeRequestMock.mockImplementationOnce(() => {
      return Promise.reject({
        res: { statusCode: 555 } as NeedleResponse,
      });
    });

    const sastSettings = {
      sastEnabled: true,
      localCodeEngine: {
        url: 'http://local-engine/api',
        allowCloudUpload: false,
        enabled: true,
      },
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeTestResults(
      '.',
      {
        path: '',
        code: true,
        debug: true,
      },
      sastSettings,
      'test-id',
    );
    const statusCalledWith = makeRequestMock.mock.calls[0][0];
    expect(statusCalledWith).toEqual({
      method: 'get',
      url: 'http://local-engine/status',
    });

    // if /status call throws are unhandled, `analyzeFolder` is never called
    expect(analyzeFoldersSpy).toHaveBeenCalled();
  });
});

function stripAscii(asciiStr) {
  return asciiStr.replace(/[^ -~]+/g, '').trim();
}
