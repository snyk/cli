import { Options } from '../../../../../src/lib/types';
import * as pollingTest from '../../../../../src/lib/polling/polling-test';
import * as featureFlags from '../../../../../src/lib/feature-flags/index';
import * as common from '../../../../../src/lib/polling/common';
import { scanResults } from './fixtures/';
import { resolveAndTestFacts } from '../../../../../src/lib/ecosystems/resolve-test-facts';
import {
  JsonApi,
  Links,
} from '../../../../../src/lib/ecosystems/unmanaged/types';
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

  it('successfully resolving and testing file-signatures fact for c/c++ projects with unmanaged-deps service', async () => {
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

  it('successfully resolving and testing file-signatures fact after a retry for c/c++ projects with unmanaged-deps service', async () => {
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

  it('failed resolving and testing file-signatures since createDepGraph throws exception with unmanaged-deps service', async () => {
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

  it('failed resolving and testing file-signatures since getDepGraph throws exception with unmanaged-deps service', async () => {
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

  it('failed resolving and testing file-signatures since getIssues throws exception with unmanaged-deps service', async () => {
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
