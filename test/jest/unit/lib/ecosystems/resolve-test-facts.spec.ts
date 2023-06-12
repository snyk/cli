import { Options } from '../../../../../src/lib/types';
import { v4 as uuidv4 } from 'uuid';
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
import * as request from '../../../../../src/lib/request/promise';

describe('resolve and test facts', () => {
  beforeEach(() => {
    const orgId = uuidv4();

    jest.spyOn(request, 'makeRequestRest').mockResolvedValue({
      data: {
        attributes: {
          default_org_context: orgId,
        },
      },
    });

    jest.spyOn(request, 'makeRequest').mockResolvedValue({
      orgs: [{ id: orgId, slug: 'org1' }],
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('successfully resolving and testing file-signatures fact for c/c++ projects with unmanaged-deps service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

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

  it('successfully resolving and testing file-signatures fact for c/c++ projects with unmanaged-deps service when org slug is provided', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

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
      { org: 'org1' } as Options,
    );

    expect(testResults).toEqual(expectedTestResult);
    expect(errors).toEqual([]);
  });

  it('successfully resolving and testing file-signatures fact after a retry for c/c++ projects with unmanaged-deps service', async () => {
    const hasFeatureFlag: boolean | undefined = true;
    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockResolvedValueOnce(hasFeatureFlag);

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
