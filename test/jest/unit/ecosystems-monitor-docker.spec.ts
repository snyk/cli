import * as fs from 'fs';
import * as path from 'path';
import * as request from '../../../src/lib/request/promise';
import * as dockerPlugin from 'snyk-docker-plugin';

import { Options } from '../../../src/lib/types';
import * as ecosystems from '../../../src/lib/ecosystems';
import * as ecosystemsTypes from '../../../src/lib/ecosystems/types';
import { getFormattedMonitorOutput } from '../../../src/lib/ecosystems/monitor';
import { GoodResult, BadResult } from '../../../src/cli/commands/monitor/types';
import { ScanResult } from 'snyk-docker-plugin';

describe('monitorEcosystem docker/container', () => {
  const fixturePath = path.join(
    __dirname,
    '../../fixtures',
    'container-projects',
  );
  const cwd = process.cwd();

  function readFixture(filename: string) {
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf8');
  }

  function readJsonFixture(filename: string) {
    const contents = readFixture(filename);
    return JSON.parse(contents);
  }

  beforeAll(() => {
    process.chdir(fixturePath);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.chdir(cwd);
  });

  it('should return successful monitorResults from monitorEcosystem', async () => {
    const mavenScanResult = readJsonFixture(
      'maven-project-0-dependencies-scan-result.json',
    ) as ScanResult;
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-maven-project-0-dependencies-response.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [mavenScanResult] });
    const makeRequestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    const results: Array<GoodResult | BadResult> = [];

    const [monitorResults, monitorErrors] = await ecosystems.monitorEcosystem(
      'docker',
      ['/srv'],
      {
        path: '/srv',
        docker: true,
        org: 'my-org',
        tags: 'keyone=valueone',
      },
    );

    const actualFormattedMonitorOutput = await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      {
        path: '/srv',
        docker: true,
        org: 'my-org',
      } as Options,
    );

    expect(makeRequestSpy.mock.calls[0][0]).toEqual({
      method: 'PUT',
      url: expect.stringContaining('/monitor-dependencies'),
      json: true,
      headers: {
        'x-is-ci': expect.any(Boolean),
        authorization: expect.stringContaining('token'),
      },
      body: {
        scanResult: {
          facts: [
            {
              type: 'jarFingerprints',
              data: {
                fingerprints: [
                  {
                    digest: '68fdac71ba58fe757c1976b4cb8861a3ead6e4a5',
                    location: '/srv/error.jar',
                  },
                ],
                origin: expect.any(String),
                path: expect.any(String),
              },
            },
          ],
          identity: {
            targetFile: expect.any(String),
            type: 'maven',
          },
          target: {
            image: expect.any(String),
          },
          name: undefined,
        },
        projectName: undefined,
        method: 'cli',
        attributes: {},
        tags: [{ key: 'keyone', value: 'valueone' }],
      },
      qs: {
        org: 'my-org',
      },
    });

    expect(actualFormattedMonitorOutput).toContain(
      'Detected 0 dependencies (no project created)',
    );
  });

  it('should pass pruneRepeatedSubdependencies flag to registry when set', async () => {
    const mavenScanResult = readJsonFixture(
      'maven-project-0-dependencies-scan-result.json',
    ) as ScanResult;
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-maven-project-0-dependencies-response.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [mavenScanResult] });
    const makeRequestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    await ecosystems.monitorEcosystem('docker', ['/srv'], {
      path: '/srv',
      docker: true,
      org: 'my-org',
      pruneRepeatedSubdependencies: true,
    } as any);

    expect(makeRequestSpy).toHaveBeenCalled();
    expect(makeRequestSpy.mock.calls[0][0].body).toMatchObject({
      pruneRepeatedSubdependencies: true,
      method: 'cli',
    });
  });

  it('should not include pruneRepeatedSubdependencies in request when flag is not set', async () => {
    const mavenScanResult = readJsonFixture(
      'maven-project-0-dependencies-scan-result.json',
    ) as ScanResult;
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-maven-project-0-dependencies-response.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [mavenScanResult] });
    const makeRequestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    await ecosystems.monitorEcosystem('docker', ['/srv'], {
      path: '/srv',
      docker: true,
      org: 'my-org',
    } as any);

    expect(makeRequestSpy).toHaveBeenCalled();
    expect(makeRequestSpy.mock.calls[0][0].body).toMatchObject({
      method: 'cli',
    });
    expect(
      makeRequestSpy.mock.calls[0][0].body.pruneRepeatedSubdependencies,
    ).toBeUndefined();
  });

  it('should return projectName from registry response in JSON output by default', async () => {
    const containerScanResult = readJsonFixture(
      'container-deb-scan-result.json',
    ) as ScanResult;
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-dependencies-response-with-project-name.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [containerScanResult] });
    jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    const results: Array<GoodResult | BadResult> = [];

    const [monitorResults, monitorErrors] = await ecosystems.monitorEcosystem(
      'docker',
      ['/srv'],
      {
        path: '/srv',
        docker: true,
        org: 'test-org',
      },
    );

    const jsonOutput = await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      {
        path: '/srv',
        docker: true,
        org: 'test-org',
        json: true,
        // Feature flag not set - uses new correct behavior by default
      } as Options,
    );

    const parsedOutput = JSON.parse(jsonOutput);

    // projectName should be the actual project name from the registry by default
    expect(parsedOutput.projectName).toBe('my-custom-project-name');
    expect(parsedOutput.projectName).not.toBe(
      '7c7305e2-fbcb-44d7-8fbf-8367371c509f',
    );
  });

  it('should return id as projectName in JSON output when feature flag is enabled (legacy behavior)', async () => {
    const containerScanResult = readJsonFixture(
      'container-deb-scan-result.json',
    ) as ScanResult;
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-dependencies-response-with-project-name.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [containerScanResult] });
    jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    const results: Array<GoodResult | BadResult> = [];

    const [monitorResults, monitorErrors] = await ecosystems.monitorEcosystem(
      'docker',
      ['/srv'],
      {
        path: '/srv',
        docker: true,
        org: 'test-org',
      },
    );

    const jsonOutput = await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      {
        path: '/srv',
        docker: true,
        org: 'test-org',
        json: true,
        // Feature flag enabled - reverts to legacy behavior
        disableContainerMonitorProjectNameFix: true,
      } as Options,
    );

    const parsedOutput = JSON.parse(jsonOutput);

    // projectName should be the id (UUID) when feature flag is enabled (legacy escape hatch)
    expect(parsedOutput.projectName).toBe(
      '7c7305e2-fbcb-44d7-8fbf-8367371c509f',
    );
    expect(parsedOutput.projectName).not.toBe('my-custom-project-name');
  });

  describe('parallelization of monitor-dependencies requests', () => {
    const ORIGINAL_CONCURRENCY = process.env.SNYK_REQUEST_CONCURRENCY;

    afterEach(() => {
      if (ORIGINAL_CONCURRENCY === undefined) {
        delete process.env.SNYK_REQUEST_CONCURRENCY;
      } else {
        process.env.SNYK_REQUEST_CONCURRENCY = ORIGINAL_CONCURRENCY;
      }
    });

    function makeMavenScanResult(targetFile: string): ScanResult {
      const base = readJsonFixture(
        'maven-project-0-dependencies-scan-result.json',
      ) as ScanResult;
      return {
        ...base,
        identity: { ...base.identity, targetFile },
      };
    }

    function makeMonitorResponse(identity: string) {
      const base = readJsonFixture(
        'monitor-dependencies-response-with-project-name.json',
      ) as ecosystemsTypes.MonitorDependenciesResponse;
      return {
        ...base,
        id: `${identity}-id`,
        projectName: identity,
      };
    }

    async function runMonitor(scanResults: ScanResult[]) {
      jest.spyOn(dockerPlugin, 'scan').mockResolvedValue({ scanResults });
      return ecosystems.monitorEcosystem('docker', ['/srv'], {
        path: '/srv',
        docker: true,
        org: 'my-org',
      });
    }

    it('caps in-flight requests at the default concurrency (10)', async () => {
      delete process.env.SNYK_REQUEST_CONCURRENCY;
      const scanResults = Array.from({ length: 25 }, (_, i) =>
        makeMavenScanResult(`app-${i}`),
      );

      let inFlight = 0;
      let peakInFlight = 0;
      jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        const identity = payload.body.scanResult.identity.targetFile;
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve(makeMonitorResponse(identity));
          }, 10);
        });
      });

      await runMonitor(scanResults);

      expect(peakInFlight).toBeLessThanOrEqual(10);
      expect(peakInFlight).toBeGreaterThan(1);
    });

    it('respects SNYK_REQUEST_CONCURRENCY override', async () => {
      process.env.SNYK_REQUEST_CONCURRENCY = '3';
      const scanResults = Array.from({ length: 15 }, (_, i) =>
        makeMavenScanResult(`app-${i}`),
      );

      let inFlight = 0;
      let peakInFlight = 0;
      jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        const identity = payload.body.scanResult.identity.targetFile;
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight--;
            resolve(makeMonitorResponse(identity));
          }, 10);
        });
      });

      await runMonitor(scanResults);

      expect(peakInFlight).toBeLessThanOrEqual(3);
    });

    it('preserves result order matching input order', async () => {
      delete process.env.SNYK_REQUEST_CONCURRENCY;
      const scanResults = ['os', 'app-1', 'app-2', 'app-3', 'app-4'].map(
        makeMavenScanResult,
      );

      // Stagger response times in reverse so completion order != input order.
      jest
        .spyOn(request, 'makeRequest')
        .mockImplementation((payload: any, i = 0) => {
          const identity = payload.body.scanResult.identity.targetFile;
          const delay =
            { os: 30, 'app-1': 20, 'app-2': 5, 'app-3': 25, 'app-4': 10 }[
              identity
            ] ?? 0;
          return new Promise((resolve) =>
            setTimeout(() => resolve(makeMonitorResponse(identity)), delay),
          );
        });

      const [results] = await runMonitor(scanResults);

      expect(results.map((r) => r.projectName)).toEqual([
        'os',
        'app-1',
        'app-2',
        'app-3',
        'app-4',
      ]);
    });

    it('throws MonitorError when any request returns 4xx (fail-fast)', async () => {
      delete process.env.SNYK_REQUEST_CONCURRENCY;
      const scanResults = ['app-1', 'app-2', 'app-3'].map(makeMavenScanResult);

      jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
        const identity = payload.body.scanResult.identity.targetFile;
        if (identity === 'app-2') {
          return Promise.reject({ code: 403, message: 'forbidden' });
        }
        return Promise.resolve(makeMonitorResponse(identity));
      });

      await expect(runMonitor(scanResults)).rejects.toThrow('forbidden');
    });

    it('accumulates 5xx errors per scan-result without aborting', async () => {
      delete process.env.SNYK_REQUEST_CONCURRENCY;
      const scanResults = ['app-1', 'app-2', 'app-3'].map(makeMavenScanResult);

      jest.spyOn(request, 'makeRequest').mockImplementation((payload: any) => {
        const identity = payload.body.scanResult.identity.targetFile;
        if (identity === 'app-2') {
          return Promise.reject({ code: 503, message: 'unavailable' });
        }
        return Promise.resolve(makeMonitorResponse(identity));
      });

      const [results, errors] = await runMonitor(scanResults);

      expect(results.map((r) => r.projectName)).toEqual(['app-1', 'app-3']);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain('Could not monitor dependencies');
    });
  });
});
