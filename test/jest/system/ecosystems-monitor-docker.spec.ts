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
        'app-vulns': true,
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
        'app-vulns': true,
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
});
