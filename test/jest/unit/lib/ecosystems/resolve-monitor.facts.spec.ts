import { Options } from '../../../../../src/lib/types';
import * as pollingMonitor from '../../../../../src/lib/polling/polling-monitor';
import { scanResults } from './fixtures/';
import { resolveAndMonitorFacts } from '../../../../../src/lib/ecosystems/resolve-monitor-facts';
import * as pluginAnalytics from '../../../../../src/lib/ecosystems/plugin-analytics';
import * as analytics from '../../../../../src/lib/analytics';
import * as httpClient from '../../../../../src/lib/request/promise';
import * as promise from '../../../../../src/lib/request/promise';

describe('resolve and test facts', () => {
  afterEach(() => jest.restoreAllMocks());

  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkNGQyMzg0LWUwMmYtNGZiYS1hNWI1LTRhMjU4MzFlM2JmOCIsInNhcGlVcmwiOiJodHRwOi8vd3d3LmZha2Utc2FwaS11cmwvIiwic3RhcnRUaW1lIjoxNjI2MDk2MTg5NzQ1fQ.fyI15bzeB_HtMvqRIBQdKpKBZgQADwn3sByEk64DzxA';

  const pollingTask = {
    pollInterval: 30000,
    maxAttempts: 25,
  };

  it('failing to resolve and monitor file-signatures fact for c/c++ projects', async () => {
    const requestMonitorPollingTokenSpy = jest.spyOn(
      pollingMonitor,
      'requestMonitorPollingToken',
    );
    const pollingMonitorWithTokenUntilDoneSpy = jest.spyOn(
      pollingMonitor,
      'pollingMonitorWithTokenUntilDone',
    );

    requestMonitorPollingTokenSpy.mockResolvedValueOnce({
      token,
      status: 'ERROR',
      pollingTask,
    });

    pollingMonitorWithTokenUntilDoneSpy.mockRejectedValueOnce({
      code: 500,
      message:
        'Internal error (reference: eb9ab16c-1d33-4586-bf99-ef30c144d1f1)',
    });

    const [testResults, errors] = await resolveAndMonitorFacts(
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors[0]).toEqual({
      error: 'Could not monitor dependencies in path',
      path: 'path',
      scanResult: {
        analytics: [
          {
            data: {
              totalFileSignatures: 3,
              totalSecondsElapsedToGenerateFileSignatures: 0,
            },
            name: 'fileSignaturesAnalyticsContext',
          },
        ],
        facts: [
          {
            data: [
              {
                hashes_ffm: [
                  { data: 'ucMc383nMM/wkFRM4iOo5Q', format: 1 },
                  { data: 'k+DxEmslFQWuJsZFXvSoYw', format: 1 },
                ],
                path: 'fastlz_example/fastlz.h',
              },
            ],
            type: 'fileSignatures',
          },
        ],
        identity: { type: 'cpp' },
        name: 'my-unmanaged-c-project',
        target: {
          branch: 'master',
          remoteUrl: 'https://github.com/some-org/some-unmanaged-project.git',
        },
      },
    });
  });

  it('failing to resolve and monitor file-signatures fact for c/c++ projects when the job is cancelled', async () => {
    const requestMonitorPollingTokenSpy = jest.spyOn(
      pollingMonitor,
      'requestMonitorPollingToken',
    );
    const makeRequestSpy = jest.spyOn(promise, 'makeRequest');

    requestMonitorPollingTokenSpy.mockResolvedValueOnce({
      token,
      status: 'OK',
      pollingTask,
    });

    makeRequestSpy.mockResolvedValueOnce({
      token,
      status: 'CANCELLED',
      pollingTask,
    });

    const [testResults, errors] = await resolveAndMonitorFacts(
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([]);
    expect(errors[0]).toEqual({
      error: 'Could not monitor dependencies in path',
      path: 'path',
      scanResult: {
        analytics: [
          {
            data: {
              totalFileSignatures: 3,
              totalSecondsElapsedToGenerateFileSignatures: 0,
            },
            name: 'fileSignaturesAnalyticsContext',
          },
        ],
        facts: [
          {
            data: [
              {
                hashes_ffm: [
                  { data: 'ucMc383nMM/wkFRM4iOo5Q', format: 1 },
                  { data: 'k+DxEmslFQWuJsZFXvSoYw', format: 1 },
                ],
                path: 'fastlz_example/fastlz.h',
              },
            ],
            type: 'fileSignatures',
          },
        ],
        identity: { type: 'cpp' },
        name: 'my-unmanaged-c-project',
        target: {
          branch: 'master',
          remoteUrl: 'https://github.com/some-org/some-unmanaged-project.git',
        },
      },
    });
  });

  it('successfully resolves and monitor file-signatures fact for c/c++ projects', async () => {
    const resolveAndTestFactsSpy = jest.spyOn(
      pollingMonitor,
      'requestMonitorPollingToken',
    );
    const pollingMonitorWithTokenUntilDoneSpy = jest.spyOn(
      pollingMonitor,
      'pollingMonitorWithTokenUntilDone',
    );

    resolveAndTestFactsSpy.mockResolvedValueOnce({
      token,
      status: 'OK',
      pollingTask,
    });

    pollingMonitorWithTokenUntilDoneSpy.mockResolvedValueOnce({
      ok: true,
      org: 'fake-org-name',
      id: 'fake-id',
      isMonitored: true,
      licensesPolicy: expect.any(Object),
      uri: 'fake-url',
      projectName: 'my-unmanaged-c-project',
      trialStarted: false,
      path: 'random-fake-path',
    });

    const extractAndApplyPluginAnalyticsSpy = jest.spyOn(
      pluginAnalytics,
      'extractAndApplyPluginAnalytics',
    );

    const addAnalyticsSpy = jest.spyOn(analytics, 'add');
    const [testResults, errors] = await resolveAndMonitorFacts(
      scanResults,
      {} as Options,
    );

    expect(extractAndApplyPluginAnalyticsSpy).toHaveBeenCalledTimes(1);
    expect(addAnalyticsSpy).toHaveBeenCalledWith('asyncRequestToken', token);
    expect(addAnalyticsSpy).toHaveBeenLastCalledWith(
      'fileSignaturesAnalyticsContext',
      {
        totalFileSignatures: 3,
        totalSecondsElapsedToGenerateFileSignatures: 0,
      },
    );
    expect(addAnalyticsSpy).toHaveBeenCalledTimes(2);
    expect(testResults).toEqual([
      {
        ok: true,
        org: 'fake-org-name',
        id: 'fake-id',
        isMonitored: true,
        licensesPolicy: {},
        uri: 'fake-url',
        projectName: 'my-unmanaged-c-project',
        trialStarted: false,
        path: 'path',
        scanResult: {
          name: 'my-unmanaged-c-project',
          facts: [
            {
              type: 'fileSignatures',
              data: [
                {
                  path: 'fastlz_example/fastlz.h',
                  hashes_ffm: [
                    { format: 1, data: 'ucMc383nMM/wkFRM4iOo5Q' },
                    { format: 1, data: 'k+DxEmslFQWuJsZFXvSoYw' },
                  ],
                },
              ],
            },
          ],
          identity: { type: 'cpp' },
          target: {
            remoteUrl: 'https://github.com/some-org/some-unmanaged-project.git',
            branch: 'master',
          },
          analytics: [
            {
              data: {
                totalFileSignatures: 3,
                totalSecondsElapsedToGenerateFileSignatures: 0,
              },
              name: 'fileSignaturesAnalyticsContext',
            },
          ],
        },
      },
    ]);
    expect(errors).toEqual([]);
  });

  it('successfully send tags and attributes for c/c++ projects', async () => {
    const resolveAndTestFactsSpy = jest.spyOn(
      pollingMonitor,
      'requestMonitorPollingToken',
    );

    resolveAndTestFactsSpy.mockResolvedValueOnce({
      token,
      status: 'OK',
      pollingTask,
    });

    const httpClientSpy = jest.spyOn(httpClient, 'makeRequest');

    httpClientSpy.mockResolvedValueOnce({
      ok: true,
      org: 'fake-org-name',
      id: 'fake-id',
      isMonitored: true,
      licensesPolicy: expect.any(Object),
      uri: 'fake-url',
      projectName: 'my-unmanaged-c-project',
      trialStarted: false,
      path: 'random-fake-path',
    });

    await resolveAndMonitorFacts(scanResults, ({
      'project-tags': 'tag1=value1,tag2=value2,tag3=value3',
      'project-business-criticality': 'medium',
      'project-environment': 'saas',
      'project-lifecycle': 'development',
    } as unknown) as Options);
    expect(httpClientSpy).toHaveBeenCalledTimes(1);
    expect(httpClientSpy).toBeCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          tags: [
            { key: 'tag1', value: 'value1' },
            { key: 'tag2', value: 'value2' },
            { key: 'tag3', value: 'value3' },
          ],
          attributes: {
            criticality: ['medium'],
            environment: ['saas'],
            lifecycle: ['development'],
          },
        }),
      }),
    );
  });
});
