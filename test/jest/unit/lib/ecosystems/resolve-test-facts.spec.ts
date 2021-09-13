import { Options } from '../../../../../src/lib/types';
import * as pollingTest from '../../../../../src/lib/polling/polling-test';
import { depGraphData, scanResults } from './fixtures/';
import { resolveAndTestFacts } from '../../../../../src/lib/ecosystems/resolve-test-facts';
import * as pluginAnalytics from '../../../../../src/lib/ecosystems/plugin-analytics';
import * as analytics from '../../../../../src/lib/analytics';

describe('resolve and test facts', () => {
  afterEach(() => jest.restoreAllMocks());

  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlkNGQyMzg0LWUwMmYtNGZiYS1hNWI1LTRhMjU4MzFlM2JmOCIsInNhcGlVcmwiOiJodHRwOi8vd3d3LmZha2Utc2FwaS11cmwvIiwic3RhcnRUaW1lIjoxNjI2MDk2MTg5NzQ1fQ.fyI15bzeB_HtMvqRIBQdKpKBZgQADwn3sByEk64DzxA';

  const pollingTask = {
    pollInterval: 30000,
    maxAttempts: 25,
  };

  it('failing to resolve and test file-signatures fact for c/c++ projects', async () => {
    const requestTestPollingTokenSpy = jest.spyOn(
      pollingTest,
      'requestTestPollingToken',
    );
    const pollingTestWithTokenUntilDoneSpy = jest.spyOn(
      pollingTest,
      'pollingTestWithTokenUntilDone',
    );

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

  it('successfully resolving and testing file-signatures fact for c/c++ projects', async () => {
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
        issuesData: {},
        issues: [],
        depGraphData,
      },
    ]);
    expect(errors).toEqual([]);
  });
});
