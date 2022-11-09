import { Options } from '../../../../../src/lib/types';
import * as pollingTest from '../../../../../src/lib/polling/polling-test';
import * as featureFlags from '../../../../../src/lib/feature-flags/index';
import * as common from '../../../../../src/lib/polling/common';
import * as promise from '../../../../../src/lib/request/promise';
import { depGraphData, scanResults } from './fixtures/';
import { resolveAndTestFacts } from '../../../../../src/lib/ecosystems/resolve-test-facts';
import * as pluginAnalytics from '../../../../../src/lib/ecosystems/plugin-analytics';
import * as analytics from '../../../../../src/lib/analytics';
import {
  JsonApi,
  Links,
  LocationResponse,
  Data,
  Attributes,
  DepGraphDataOpenAPI,
  ComponentDetailsOpenApi,
  PkgManager,
  GraphOpenApi,
  IssuesResponseData,
  IssueOpenApi,
  FixInfoOpenApi,
  IssuesDataOpenApi,
  FileSignaturesDetailsOpenApi,
  IssuesResponseDataResult,
} from '../../../../../src/lib/ecosystems/unmanaged/types';
import { DepsFilePaths } from 'snyk-cpp-plugin/dist/types';
import { issuesResponseData } from './fixtures/issues-response';
import { expectedTestResult } from './fixtures/expected-test-result-new-impl';
import { createDepgraphResponse } from './fixtures/create-dep-graph-response';
import {
  getDepGraphResponse,
  getDepGraphResponseInProgress,
} from './fixtures/get-dep-graph-response';
import * as request from '../../../../../src/lib/request/request';

describe('resolve and test facts', () => {
  afterEach(() => jest.restoreAllMocks());

  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkNGQyMzg0LWUwMmYtNGZiYS1hNWI1LTRhMjU4MzFlM2JmOCIsInNhcGlVcmwiOiJodHRwOi8vd3d3LmZha2Utc2FwaS11cmwvIiwic3RhcnRUaW1lIjoxNjI2MDk2MTg5NzQ1fQ.fyI15bzeB_HtMvqRIBQdKpKBZgQADwn3sByEk64DzxA';

  const pollingTask = {
    pollInterval: 30000,
    maxAttempts: 25,
  };

  it('failing to resolve and test file-signatures fact for c/c++ projects', async () => {
    const hasFeatureFlag: boolean | undefined = false;
    const hasFeatureFlagSpy = jest.spyOn(featureFlags, 'hasFeatureFlag');
    hasFeatureFlagSpy.mockResolvedValueOnce(hasFeatureFlag);

    const requestTestPollingTokenSpy = jest.spyOn(
      pollingTest,
      'requestTestPollingToken',
    );
    const pollingTestWithTokenUntilDoneSpy = jest.spyOn(
      pollingTest,
      'pollingTestWithTokenUntilDone',
    );

    const createDepGraphSpy = jest.spyOn(pollingTest, 'createDepGraph');

    const getDepGraphSpy = jest.spyOn(pollingTest, 'getDepGraph');

    const getIssuesSpy = jest.spyOn(pollingTest, 'getIssues');

    requestTestPollingTokenSpy.mockResolvedValueOnce({
      token,
      status: 'ERROR',
      pollingTask,
    });

    pollingTestWithTokenUntilDoneSpy.mockRejectedValueOnce({
      code: 500,
      message:
        'Internal error (reference: eb9ab16c-1d33-4586-bf99-ef30c144d1f1)',
    });

    const links: Links = { self: '' };
    const jsonApi: JsonApi = { version: '' };
    const data: LocationResponse = { id: '1234', location: '', type: '' };

    createDepGraphSpy.mockResolvedValueOnce({
      data: data,
      jsonapi: jsonApi,
      links: links,
    });

    const graph: GraphOpenApi = {
      root_node_id: '',
      nodes: [],
    };
    const pkg_manager: PkgManager = { name: '' };
    const componentDetailsOpenApi: ComponentDetailsOpenApi = {};
    const depGraphDataOpenAPI: DepGraphDataOpenAPI = {
      schema_version: '',
      pkg_manager: pkg_manager,
      pkgs: [],
      graph: graph,
    };
    const attributes: Attributes = {
      start_time: 0,
      in_progress: false,
      dep_graph_data: depGraphDataOpenAPI,
      component_details: componentDetailsOpenApi,
    };
    const getResponseData: Data = { id: '', type: '', attributes: attributes };

    getDepGraphSpy.mockResolvedValueOnce({
      data: getResponseData,
      jsonapi: jsonApi,
      links: links,
    });

    const fileSignaturesDetailsOpenApi: FileSignaturesDetailsOpenApi = {};
    const depsFilePaths: DepsFilePaths = {};
    const issuesDataOpenApi: IssuesDataOpenApi = {};
    const fixInfoOpenApi: FixInfoOpenApi = {
      upgrade_paths: [],
      nearest_fixed_in_version: '',
      is_patchable: false,
    };
    const issueOpenApi: IssueOpenApi = {
      pkg_name: '',
      issue_id: '',
      pkg_version: '',
      fix_info: fixInfoOpenApi,
    };
    const issuesOpenApi: IssueOpenApi[] = [issueOpenApi];
    const result: IssuesResponseDataResult = {
      start_time: '',
      issues: issuesOpenApi,
      issues_data: issuesDataOpenApi,
      dep_graph: depGraphDataOpenAPI,
      deps_file_paths: depsFilePaths,
      file_signatures_details: fileSignaturesDetailsOpenApi,
      type: '',
    };
    const issuesResponseData: IssuesResponseData = { id: '', result: result };

    getIssuesSpy.mockResolvedValueOnce({
      data: issuesResponseData,
      jsonapi: jsonApi,
      links: links,
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors[0]).toContain(
      'Internal error (reference: eb9ab16c-1d33-4586-bf99-ef30c144d1f1)',
    );
  });

  it.each`
    actual         | expected
    ${'CANCELLED'} | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
    ${'ERROR'}     | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
  `(
    'should handle different file-signatures processing statuses for the testing flow',
    async ({ actual, expected }) => {
      const hasFeatureFlag: boolean | undefined = false;
      const hasFeatureFlagSpy = jest.spyOn(featureFlags, 'hasFeatureFlag');
      hasFeatureFlagSpy.mockResolvedValueOnce(hasFeatureFlag);

      const requestTestPollingTokenSpy = jest.spyOn(
        pollingTest,
        'requestTestPollingToken',
      );
      const makeRequestSpy = jest.spyOn(promise, 'makeRequest');

      requestTestPollingTokenSpy.mockResolvedValueOnce({
        token,
        status: 'OK',
        pollingTask,
      });

      makeRequestSpy.mockResolvedValueOnce({
        token,
        status: actual,
        pollingTask,
      });

      const [testResults, errors] = await resolveAndTestFacts(
        'cpp',
        scanResults,
        {} as Options,
      );

      expect(testResults).toEqual([]);
      expect(errors[0]).toContain(expected);
    },
  );

  it('successfully resolving and testing file-signatures fact for c/c++ projects', async () => {
    const hasFeatureFlag: boolean | undefined = false;
    const hasFeatureFlagSpy = jest.spyOn(featureFlags, 'hasFeatureFlag');
    hasFeatureFlagSpy.mockResolvedValueOnce(hasFeatureFlag);

    const resolveAndTestFactsSpy = jest.spyOn(
      pollingTest,
      'requestTestPollingToken',
    );
    const pollingTestWithTokenUntilDoneSpy = jest.spyOn(
      pollingTest,
      'pollingTestWithTokenUntilDone',
    );

    resolveAndTestFactsSpy.mockResolvedValueOnce({
      token,
      status: 'OK',
      pollingTask,
    });

    pollingTestWithTokenUntilDoneSpy.mockResolvedValueOnce({
      issuesData: {},
      issues: [],
      depGraphData,
      fileSignaturesDetails: {},
      vulnerabilities: [],
      path: 'path',
      dependencyCount: 1,
      packageManager: 'Unmanaged (C/C++)',
      depsFilePaths: undefined,
    });

    const extractAndApplyPluginAnalyticsSpy = jest.spyOn(
      pluginAnalytics,
      'extractAndApplyPluginAnalytics',
    );

    const addAnalyticsSpy = jest.spyOn(analytics, 'add');
    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(extractAndApplyPluginAnalyticsSpy).toHaveBeenCalledTimes(1);
    expect(addAnalyticsSpy).toHaveBeenCalledWith('asyncRequestToken', token);
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'fileSignaturesAnalyticsContext',
      {
        totalFileSignatures: 3,
        totalSecondsElapsedToGenerateFileSignatures: 0,
      },
    );
    expect(addAnalyticsSpy).toHaveBeenCalledTimes(4);
    expect(testResults).toEqual([
      {
        issuesData: {},
        issues: [],
        depGraphData,
        fileSignaturesDetails: {},
        vulnerabilities: [],
        path: 'path',
        dependencyCount: 1,
        packageManager: 'Unmanaged (C/C++)',
        depsFilePaths: undefined,
        displayTargetFile: '',
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('successfully resolving and testing file-signatures fact for c/c++ projects with new unmanaged service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

    jest.spyOn(request, 'makeRequest').mockImplementationOnce(async () => ({
      res: {} as any,
      body:
        '{ "data":{"attributes":{"default_org_context": "xx111x11-11bd-1e1e-1111-ff111b111f11"}}}',
    }));

    jest.spyOn(common, 'delayNextStep').mockImplementation();

    jest.spyOn(pollingTest, 'createDepGraph').mockResolvedValueOnce({
      data: createDepgraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getDepGraph').mockResolvedValue({
      data: getDepGraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getIssues').mockResolvedValueOnce({
      data: issuesResponseData,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual(expectedTestResult);
    expect(errors).toEqual([]);
  });

  it('successfully resolving and testing file-signatures fact after a retry for c/c++ projects with new unmanaged service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

    jest.spyOn(request, 'makeRequest').mockImplementationOnce(async () => ({
      res: {} as any,
      body:
        '{ "data":{"attributes":{"default_org_context": "xx111x11-11bd-1e1e-1111-ff111b111f11"}}}',
    }));

    jest.spyOn(common, 'delayNextStep').mockImplementation();

    jest.spyOn(pollingTest, 'createDepGraph').mockResolvedValueOnce({
      data: createDepgraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getDepGraph').mockResolvedValue({
      data: getDepGraphResponseInProgress,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getDepGraph').mockResolvedValue({
      data: getDepGraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getIssues').mockResolvedValueOnce({
      data: issuesResponseData,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual(expectedTestResult);
    expect(errors).toEqual([]);
  });

  it('failed resolving and testing file-signatures since createDepGraph throws exception with new unmanaged service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

    jest.spyOn(request, 'makeRequest').mockImplementationOnce(async () => ({
      res: {} as any,
      body:
        '{ "data":{"attributes":{"default_org_context": "xx111x11-11bd-1e1e-1111-ff111b111f11"}}}',
    }));

    jest.spyOn(common, 'delayNextStep').mockImplementation();

    jest.spyOn(pollingTest, 'createDepGraph').mockImplementation(() => {
      throw new Error('500');
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors).toEqual(['Could not test dependencies in path']);
  });

  it('failed resolving and testing file-signatures since getDepGraph throws exception with new unmanaged service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

    jest.spyOn(request, 'makeRequest').mockImplementationOnce(async () => ({
      res: {} as any,
      body:
        '{ "data":{"attributes":{"default_org_context": "xx111x11-11bd-1e1e-1111-ff111b111f11"}}}',
    }));

    jest.spyOn(common, 'delayNextStep').mockImplementation();

    jest.spyOn(pollingTest, 'createDepGraph').mockResolvedValueOnce({
      data: createDepgraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getDepGraph').mockImplementation(() => {
      throw new Error('500');
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors).toEqual(['Could not test dependencies in path']);
  });

  it('failed resolving and testing file-signatures since getIssues throws exception with new unmanaged service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

    jest.spyOn(request, 'makeRequest').mockImplementationOnce(async () => ({
      res: {} as any,
      body:
        '{ "data":{"attributes":{"default_org_context": "xx111x11-11bd-1e1e-1111-ff111b111f11"}}}',
    }));

    jest.spyOn(common, 'delayNextStep').mockImplementation();

    jest.spyOn(pollingTest, 'createDepGraph').mockResolvedValueOnce({
      data: createDepgraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getDepGraph').mockResolvedValue({
      data: getDepGraphResponse,
      jsonapi: { version: 'v1.0' } as JsonApi,
      links: { self: '' } as Links,
    });

    jest.spyOn(pollingTest, 'getIssues').mockImplementation(() => {
      throw new Error('500');
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors).toEqual(['Could not test dependencies in path']);
  });
});
