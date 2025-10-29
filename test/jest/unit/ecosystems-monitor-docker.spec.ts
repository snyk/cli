import * as fs from 'fs';
import * as path from 'path';
import * as request from '../../../src/lib/request/promise';
import * as dockerPlugin from 'snyk-docker-plugin';
import * as pruneLib from '../../../src/lib/prune';

import { Options } from '../../../src/lib/types';
import * as ecosystems from '../../../src/lib/ecosystems';
import * as ecosystemsTypes from '../../../src/lib/ecosystems/types';
import { getFormattedMonitorOutput } from '../../../src/lib/ecosystems/monitor';
import { GoodResult, BadResult } from '../../../src/cli/commands/monitor/types';
import { ScanResult } from 'snyk-docker-plugin';
import { createFromJSON } from '@snyk/dep-graph';

describe('monitorEcosystem docker/container', () => {
  const fixturePath = path.join(
    __dirname,
    '../../fixtures',
    'container-projects',
  );
  const cwd = process.cwd();

  let mavenScanResult: ScanResult;
  let monitorDependenciesResponse: ecosystemsTypes.MonitorDependenciesResponse;

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

  beforeEach(() => {
    mavenScanResult = readJsonFixture(
      'maven-project-0-dependencies-scan-result.json',
    ) as ScanResult;
    monitorDependenciesResponse = readJsonFixture(
      'monitor-maven-project-0-dependencies-response.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.chdir(cwd);
  });

  it('should return successful monitorResults from monitorEcosystem', async () => {
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

  it('should prune repeated subdependencies when option is enabled', async () => {
   
    const depGraphData = {
      schemaVersion: '1.2.0',
      pkgManager: {
        name: 'deb',
        repositories: [{ alias: 'debian:11' }]
      },
      pkgs: [
        { id: 'root@1.0.0', info: { name: 'root', version: '1.0.0' } },
        { id: 'shared@1.0.0', info: { name: 'shared', version: '1.0.0' } },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          { nodeId: 'root-node', pkgId: 'root@1.0.0', deps: [
            { nodeId: 'shared-node-1' },
            { nodeId: 'shared-node-2' }
          ]},
          { nodeId: 'shared-node-1', pkgId: 'shared@1.0.0', deps: [] },
          { nodeId: 'shared-node-2', pkgId: 'shared@1.0.0', deps: [] },
        ]
      }
    };

    const depGraph = createFromJSON(depGraphData);

    const testScanResult = {
      ...mavenScanResult,
      facts: [
        ...mavenScanResult.facts,
        {
          type: 'depGraph' as const,
          data: depGraph,
        },
      ],
      identity: {
        ...mavenScanResult.identity,
        type: 'deb',
      },
    } as ScanResult;

    jest
      .spyOn(dockerPlugin, 'scan')
      .mockResolvedValue({ scanResults: [testScanResult] });
    
    const pruneGraphSpy = jest.spyOn(pruneLib, 'pruneGraph');

    jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    await ecosystems.monitorEcosystem(
      'docker',
      ['/srv'],
      {
        path: '/srv',
        docker: true,
        org: 'my-org',
        pruneRepeatedSubdependencies: true,
      },
    );

    expect(pruneGraphSpy).toHaveBeenCalledTimes(1);
    expect(pruneGraphSpy).toHaveBeenCalledWith(
      depGraph,
      'deb',
      true,
    );

    const prunedGraph = await pruneGraphSpy.mock.results[0].value;
    expect(prunedGraph).toBeDefined();
    
    expect(prunedGraph).not.toBe(depGraph);
    expect(prunedGraph.toJSON()).not.toEqual(depGraph.toJSON());
  });
});
