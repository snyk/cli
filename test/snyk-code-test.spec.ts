import { analyzeFolders, AnalysisSeverity } from '@snyk/code-client';
jest.mock('@snyk/code-client');
const analyzeFoldersMock = analyzeFolders as jest.Mock;

import { runTest } from '../src/lib/snyk-test/run-test';
import { loadJson } from './utils';
import * as featureFlags from '../src/lib/feature-flags';
import { config as userConfig } from '../src/lib/user-config';
import { getCodeAnalysisAndParseResults } from '../src/lib/snyk-test/run-code-test';
import { Options, TestOptions } from '../src/lib/types';

let apiUserConfig;
let isFeatureFlagSupportedForOrgSpy;
const fakeApiKey = '123456789';
const sampleSarifResponse = loadJson(
  __dirname + '/fixtures/code/sample-sarif.json',
);
const sampleAnalyzeFoldersResponse = loadJson(
  __dirname + '/fixtures/code/sample-analyze-folders-response.json',
);

describe('Test snyk code', () => {
  beforeAll(() => {
    apiUserConfig = userConfig.get('api');
    userConfig.set('api', fakeApiKey);
    isFeatureFlagSupportedForOrgSpy = jest.spyOn(
      featureFlags,
      'isFeatureFlagSupportedForOrg',
    );
  });

  afterAll(() => {
    userConfig.set('api', apiUserConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should fail if we do not have ff', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      interactive: false,
      showVulnPaths: 'none',
    };
    isFeatureFlagSupportedForOrgSpy.mockResolvedValueOnce({ code: 401 });

    await expect(
      runTest('code', 'some/path', { code: true, ...options }),
    ).rejects.toThrowError(
      /Authentication failed. Please check the API token on/,
    );
  });

  it('succeed calling runTest with code option', async () => {
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      interactive: false,
      showVulnPaths: 'none',
      code: true,
    };

    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    isFeatureFlagSupportedForOrgSpy.mockResolvedValueOnce({ ok: true });

    const res = await runTest('code', 'some/path', options);
    expect(res).toStrictEqual(sampleSarifResponse);
  });

  it('analyzeFolders should be called with the right arguments', async () => {
    const baseURL = expect.any(String);
    const sessionToken = fakeApiKey;
    const severity = AnalysisSeverity.info;
    const paths: string[] = ['.'];
    const sarif = true;

    const codeAnalysisArgs = {
      baseURL,
      sessionToken,
      severity,
      paths,
      sarif,
    };

    const analyzeFoldersSpy = analyzeFoldersMock.mockResolvedValue(
      sampleAnalyzeFoldersResponse,
    );
    await getCodeAnalysisAndParseResults('snyk code', '.', {
      path: '',
      code: true,
    });

    expect(analyzeFoldersSpy.mock.calls[0]).toEqual([codeAnalysisArgs]);
  });

  it('analyzeFolders should should return the right sarif response', async () => {
    analyzeFoldersMock.mockResolvedValue(sampleAnalyzeFoldersResponse);
    const actual = await getCodeAnalysisAndParseResults('snyk code', '.', {
      path: '',
      code: true,
    });

    expect(actual).toEqual(sampleSarifResponse);
  });
});
