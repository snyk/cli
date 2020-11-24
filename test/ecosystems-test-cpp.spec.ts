import * as fs from 'fs';
import * as path from 'path';

import * as ecosystems from '../src/lib/ecosystems';
import * as ecosystemsTypes from '../src/lib/ecosystems/types';
import * as request from '../src/lib/request/promise';
import * as snykPolicyLib from 'snyk-policy';

import { TestCommandResult } from '../src/cli/commands/types';
const osName = require('os-name');

const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

describe('test ecosystem - cpp', () => {
  const cwd = process.cwd();

  function readFixture(fixturePath: string, filename: string) {
    if (isWindows) {
      filename = filename.replace('.txt', '-windows.txt');
    }
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }

  function readJsonFixture(fixturePath: string, filename: string) {
    const contents = readFixture(fixturePath, filename);
    return JSON.parse(contents);
  }

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.chdir(cwd);
  });

  describe('cpp-project fixture', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'cpp-project');
    const displayTxt = readFixture(fixturePath, 'display.txt');
    const debugDisplayTxt = readFixture(fixturePath, 'debug-display.txt');
    const errorTxt = readFixture(fixturePath, 'error.txt');
    const testResult = readJsonFixture(
      fixturePath,
      'testResults.json',
    ) as ecosystemsTypes.TestResult;
    const stringifyTestResults = JSON.stringify([testResult], null, 2);

    beforeAll(() => {
      process.chdir(fixturePath);
    });

    it('should return human readable result when no json option given', async () => {
      const makeRequestSpy = jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ result: testResult });
      const expected = TestCommandResult.createHumanReadableTestCommandResult(
        displayTxt,
        stringifyTestResults,
      );
      const actual = await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
      });
      expect(makeRequestSpy.mock.calls[0][0]).toEqual({
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
                  {
                    filePath: 'add.h',
                    hash: 'aeca71a6e39f99a24ecf4c088eee9cb8',
                  },
                  {
                    filePath: 'main.cpp',
                    hash: 'ad3365b3370ef6b1c3e778f875055f19',
                  },
                ],
              },
            ],
            identity: {
              type: 'cpp',
            },
            name: expect.any(String),
            target: {
              branch: expect.any(String),
              remoteUrl: expect.any(String),
            },
          },
        },
        headers: {
          authorization: expect.stringContaining('token'),
          'x-is-ci': expect.any(Boolean),
        },
        json: true,
        method: 'POST',
        url: expect.stringContaining('/test-dependencies'),
        qs: expect.any(Object),
      });
      expect(actual).toEqual(expected);
    });

    it('should return json result when json option', async () => {
      const makeRequestSpy = jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ result: testResult });
      const expected = TestCommandResult.createJsonTestCommandResult(
        stringifyTestResults,
      );
      const actual = await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
        json: true,
      });
      expect(makeRequestSpy.mock.calls[0][0]).toEqual({
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
                  {
                    filePath: 'add.h',
                    hash: 'aeca71a6e39f99a24ecf4c088eee9cb8',
                  },
                  {
                    filePath: 'main.cpp',
                    hash: 'ad3365b3370ef6b1c3e778f875055f19',
                  },
                ],
              },
            ],
            identity: {
              type: 'cpp',
            },
            name: expect.any(String),
            target: {
              branch: expect.any(String),
              remoteUrl: expect.any(String),
            },
          },
        },
        headers: {
          authorization: expect.stringContaining('token'),
          'x-is-ci': expect.any(Boolean),
        },
        json: true,
        method: 'POST',
        url: expect.stringContaining('/test-dependencies'),
        qs: expect.any(Object),
      });
      expect(actual).toEqual(expected);
    });

    it('should return fingerprints when debug option is set', async () => {
      const makeRequestSpy = jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ result: testResult });
      const expected = TestCommandResult.createHumanReadableTestCommandResult(
        debugDisplayTxt,
        stringifyTestResults,
      );
      const actual = await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
        debug: true,
      });
      expect(makeRequestSpy).toHaveBeenCalled();
      expect(actual).toEqual(expected);
    });

    it('should throw error when response code is not 200', async () => {
      const error = { code: 401, message: 'Invalid auth token' };
      jest.spyOn(request, 'makeRequest').mockRejectedValue(error);
      const expected = new Error(error.message);
      expect.assertions(1);
      try {
        await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
        });
      } catch (error) {
        expect(error).toEqual(expected);
      }
    });

    it('should return error when there was a problem testing dependencies', async () => {
      jest
        .spyOn(request, 'makeRequest')
        .mockRejectedValue('Something went wrong');
      const expected = TestCommandResult.createHumanReadableTestCommandResult(
        errorTxt,
        '[]',
      );
      const actual = await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
      });
      expect(actual).toEqual(expected);
    });
  });
  describe('cpp-project-with-policy fixture', () => {
    const fixturePath = path.join(
      __dirname,
      'fixtures',
      'cpp-project-with-policy',
    );
    const policyFile = readFixture(fixturePath, '.snyk');

    beforeAll(() => {
      process.chdir(fixturePath);
    });

    it('should send policy when .snyk found locally', async () => {
      const makeRequestSpy = jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ result: {} });
      await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
      });
      expect(makeRequestSpy.mock.calls[0][0]).toEqual({
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
                  {
                    filePath: 'add.h',
                    hash: 'aeca71a6e39f99a24ecf4c088eee9cb8',
                  },
                  {
                    filePath: 'main.cpp',
                    hash: 'ad3365b3370ef6b1c3e778f875055f19',
                  },
                ],
              },
            ],
            identity: {
              type: 'cpp',
            },
            name: expect.any(String),
            policy: policyFile,
            target: {
              branch: expect.any(String),
              remoteUrl: expect.any(String),
            },
          },
        },
        headers: {
          authorization: expect.stringContaining('token'),
          'x-is-ci': expect.any(Boolean),
        },
        json: true,
        method: 'POST',
        url: expect.stringContaining('/test-dependencies'),
        qs: expect.any(Object),
      });
    });
    it('should not send policy when ignore-policy option set', async () => {
      const makeRequestSpy = jest
        .spyOn(request, 'makeRequest')
        .mockResolvedValue({ result: {} });
      await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
        'ignore-policy': true,
      });
      expect(makeRequestSpy.mock.calls[0][0]).toEqual({
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
                  {
                    filePath: 'add.h',
                    hash: 'aeca71a6e39f99a24ecf4c088eee9cb8',
                  },
                  {
                    filePath: 'main.cpp',
                    hash: 'ad3365b3370ef6b1c3e778f875055f19',
                  },
                ],
              },
            ],
            identity: {
              type: 'cpp',
            },
            name: expect.any(String),
            policy: (await snykPolicyLib.create()).toString(), // policy replaced with empty one
            target: {
              branch: expect.any(String),
              remoteUrl: expect.any(String),
            },
          },
        },
        headers: {
          authorization: expect.stringContaining('token'),
          'x-is-ci': expect.any(Boolean),
        },
        json: true,
        method: 'POST',
        url: expect.stringContaining('/test-dependencies'),
        qs: {
          org: null,
          ignorePolicy: true,
        },
      });
    });
  });
});
