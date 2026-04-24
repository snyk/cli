import { selectAndExecuteTestStrategy } from '../../../../../src/lib/ecosystems/test';
import * as request from '../../../../../src/lib/request/promise';
import {
  ScanResult,
  TestResult,
} from '../../../../../src/lib/ecosystems/types';
import { TestDependenciesResponse } from '../../../../../src/lib/snyk-test/legacy';

describe('ecosystems test flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes base scan result first, then parallelizes remaining requests', async () => {
    const requestsByIdentity: string[] = [];
    let firstRequestResolved = false;
    let secondRequestStartedBeforeFirstResolved = false;
    let thirdRequestStartedBeforeFirstResolved = false;

    const makeRequestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockImplementation((payload: any) => {
        const identity = payload.body.scanResult.identity.targetFile as string;
        requestsByIdentity.push(identity);

        return new Promise<TestDependenciesResponse>((resolve) => {
          if (identity === 'os') {
            setTimeout(() => {
              firstRequestResolved = true;
              resolve(createTestDependenciesResponse(identity));
            }, 25);
            return;
          }

          if (identity === 'app-1' && !firstRequestResolved) {
            secondRequestStartedBeforeFirstResolved = true;
          }
          if (identity === 'app-2' && !firstRequestResolved) {
            thirdRequestStartedBeforeFirstResolved = true;
          }

          resolve(createTestDependenciesResponse(identity));
        });
      });

    const scanResults = [
      createScanResult('os'),
      createScanResult('app-1'),
      createScanResult('app-2'),
    ];

    const [testResults, errors] = await selectAndExecuteTestStrategy(
      'docker',
      {
        '/workspace/image': scanResults,
      },
      {} as any,
    );

    expect(errors).toEqual([]);
    expect(makeRequestSpy).toHaveBeenCalledTimes(3);
    expect(requestsByIdentity).toEqual(['os', 'app-1', 'app-2']);
    expect(secondRequestStartedBeforeFirstResolved).toBe(false);
    expect(thirdRequestStartedBeforeFirstResolved).toBe(false);

    expect(
      testResults.map((result) => result.depGraphData.graph.rootNodeId),
    ).toEqual([
      'os',
      'app-1',
      'app-2',
    ]);
  });

  it('keeps going for non-4xx errors and returns per-scan error entries', async () => {
    jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
      const identity = payload.body.scanResult.identity.targetFile as string;
      if (identity === 'app-1') {
        return Promise.reject({ code: 500, message: 'transient issue' });
      }
      return Promise.resolve(createTestDependenciesResponse(identity));
    });

    const [testResults, errors] = await selectAndExecuteTestStrategy(
      'docker',
      {
        '/workspace/image': [
          createScanResult('os'),
          createScanResult('app-1'),
          createScanResult('app-2'),
        ],
      },
      {} as any,
    );

    expect(
      testResults.map((result) => result.depGraphData.graph.rootNodeId),
    ).toEqual([
      'os',
      'app-2',
    ]);
    expect(errors).toEqual(['Could not test dependencies in /workspace/image']);
  });

  it('fails fast on 4xx errors', async () => {
    jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
      const identity = payload.body.scanResult.identity.targetFile as string;
      if (identity === 'app-1') {
        return Promise.reject({ code: 400, message: 'bad request' });
      }
      return Promise.resolve(createTestDependenciesResponse(identity));
    });

    await expect(
      selectAndExecuteTestStrategy(
        'docker',
        {
          '/workspace/image': [
            createScanResult('os'),
            createScanResult('app-1'),
            createScanResult('app-2'),
          ],
        },
        {} as any,
      ),
    ).rejects.toThrowError('bad request');
  });
});

function createScanResult(targetFile: string): ScanResult {
  return {
    identity: {
      type: 'deb',
      targetFile,
    },
    facts: [],
  };
}

function createTestDependenciesResponse(identity: string): TestDependenciesResponse {
  return {
    result: {
      issues: [],
      issuesData: {},
      depGraphData: {
        schemaVersion: '1.2.0',
        pkgManager: {
          name: 'deb',
        },
        pkgs: [
          {
            id: `${identity}@1.0.0`,
            info: {
              name: identity,
              version: '1.0.0',
            },
          },
        ],
        graph: {
          rootNodeId: identity,
          nodes: [
            {
              nodeId: identity,
              pkgId: `${identity}@1.0.0`,
              deps: [],
            },
          ],
        },
      },
    },
    meta: {
      isPublic: false,
      isLicensesEnabled: false,
      policy: '',
      org: '',
    },
  } as unknown as TestDependenciesResponse;
}
