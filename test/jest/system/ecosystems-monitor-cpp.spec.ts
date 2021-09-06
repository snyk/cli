import * as fs from 'fs';
import * as path from 'path';
import config from '../../../src/lib/config';
import * as request from '../../../src/lib/request/promise';

import { Options } from '../../../src/lib/types';
import * as ecosystems from '../../../src/lib/ecosystems';
import * as ecosystemsTypes from '../../../src/lib/ecosystems/types';
import { getFormattedMonitorOutput } from '../../../src/lib/ecosystems/monitor';
import { GoodResult, BadResult } from '../../../src/cli/commands/monitor/types';

describe('monitorEcosystem cpp', () => {
  const fixturePath = path.join(__dirname, '../../fixtures', 'cpp-project');
  const cwd = process.cwd();

  function readFixture(filename: string) {
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf-8');
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
    const monitorDependenciesResponse = readJsonFixture(
      'monitor-dependencies-response.json',
    ) as ecosystemsTypes.MonitorDependenciesResponse;

    const makeRequestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockResolvedValue(monitorDependenciesResponse);

    const results: Array<GoodResult | BadResult> = [];

    const [monitorResults, monitorErrors] = await ecosystems.monitorEcosystem(
      'cpp',
      ['.'],
      {
        path: '',
      },
    );

    const actualFormattedMonitorOutput = await getFormattedMonitorOutput(
      results,
      monitorResults,
      monitorErrors,
      {
        source: true,
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
              type: 'cpp-fingerprints',
              data: [
                {
                  filePath: 'add.cpp',
                  hash: '52d1b046047db9ea0c581cafd4c68fe5',
                },
                { filePath: 'add.h', hash: 'aeca71a6e39f99a24ecf4c088eee9cb8' },
                {
                  filePath: 'main.cpp',
                  hash: 'ad3365b3370ef6b1c3e778f875055f19',
                },
              ],
            },
          ],
          identity: { type: 'cpp' },
          name: expect.any(String),
          target: {
            branch: expect.any(String),
            remoteUrl: expect.any(String),
          },
        },
        method: 'cli',
      },
      qs: {},
    });

    expect(actualFormattedMonitorOutput).toContain('Explore this snapshot');
  });

  it('should throw error when response code is not 200', async () => {
    const error = {
      code: 401,
      message: `Authentication failed. Please check the API token on ${config.ROOT}`,
    };
    jest.spyOn(request, 'makeRequest').mockRejectedValue(error);
    const expected = new Error(error.message);
    expect.assertions(1);
    try {
      await ecosystems.monitorEcosystem('cpp', ['.'], {
        path: '',
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it('should return error when there was a problem monitoring dependencies', async () => {
    jest
      .spyOn(request, 'makeRequest')
      .mockRejectedValue('Something went wrong');
    const expectedErrorMessage = 'Could not monitor dependencies';
    const [monitorResults, monitorErrors] = await ecosystems.monitorEcosystem(
      'cpp',
      ['.'],
      {
        path: '',
      },
    );

    const hasExpectedErrorMessage = monitorErrors[0].error.includes(
      expectedErrorMessage,
    );

    expect(monitorResults.length).toBe(0);
    expect(hasExpectedErrorMessage).toBeTruthy();
  });
});
