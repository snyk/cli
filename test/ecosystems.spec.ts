import * as fs from 'fs';
import * as path from 'path';
import * as cppPlugin from 'snyk-cpp-plugin';
import * as ecosystems from '../src/lib/ecosystems';
import * as request from '../src/lib/request/promise';
import { Options } from '../src/lib/types';
import { TestCommandResult } from '../src/cli/commands/types';
const osName = require('os-name');

const isWindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

describe('ecosystems', () => {
  describe('getPlugin', () => {
    it('should return cpp plugin when cpp ecosystem is given', () => {
      const actual = ecosystems.getPlugin('cpp');
      const expected = cppPlugin;
      expect(actual).toBe(expected);
    });

    it('should return undefined when ecosystem is not supported', () => {
      const actual = ecosystems.getPlugin('unsupportedEcosystem' as any);
      const expected = undefined;
      expect(actual).toBe(expected);
    });
  });

  describe('getEcosystem', () => {
    it('should return cpp ecosystem when options source is true', () => {
      const options: Options = {
        source: true,
        path: '',
      };
      const actual = ecosystems.getEcosystem(options);
      const expected = 'cpp';
      expect(actual).toBe(expected);
    });
    it('should return null when options source is false', () => {
      const options: Options = {
        source: false,
        path: '',
      };
      const actual = ecosystems.getEcosystem(options);
      const expected = null;
      expect(actual).toBe(expected);
    });
  });

  describe('testEcosystem', () => {
    describe('cpp', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'cpp-project');
      const cwd = process.cwd();

      function readFixture(filename: string) {
        if (isWindows) {
          filename = filename.replace('.txt', '-windows.txt');
        }

        const filePath = path.join(fixturePath, filename);
        return fs.readFileSync(filePath, 'utf-8');
      }

      function readJsonFixture(filename: string) {
        const contents = readFixture(filename);
        return JSON.parse(contents);
      }

      const displayTxt = readFixture('display.txt');
      const debugDisplayTxt = readFixture('debug-display.txt');
      const errorTxt = readFixture('error.txt');
      const testResult = readJsonFixture(
        'testResults.json',
      ) as ecosystems.TestResult;
      const stringifyTestResults = JSON.stringify([testResult], null, 2);

      beforeAll(() => {
        process.chdir(fixturePath);
      });

      afterEach(() => {
        jest.resetAllMocks();
      });

      afterAll(() => {
        process.chdir(cwd);
      });

      it('should return human readable result when no json option given', async () => {
        const makeRequestSpy = jest
          .spyOn(request, 'makeRequest')
          .mockResolvedValue(testResult);
        const expected = TestCommandResult.createHumanReadableTestCommandResult(
          displayTxt,
          stringifyTestResults,
        );
        const actual = await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
        });
        expect(makeRequestSpy.mock.calls[0][0]).toEqual({
          body: {
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
          },
          headers: {
            authorization: expect.stringContaining('token'),
            'x-is-ci': expect.any(Boolean),
          },
          json: true,
          method: 'POST',
          url: expect.stringContaining('/test-dependencies'),
        });
        expect(actual).toEqual(expected);
      });

      it('should return json result when json option', async () => {
        const makeRequestSpy = jest
          .spyOn(request, 'makeRequest')
          .mockResolvedValue(testResult);
        const expected = TestCommandResult.createJsonTestCommandResult(
          stringifyTestResults,
        );
        const actual = await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
          json: true,
        });
        expect(makeRequestSpy.mock.calls[0][0]).toEqual({
          body: {
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
          },
          headers: {
            authorization: expect.stringContaining('token'),
            'x-is-ci': expect.any(Boolean),
          },
          json: true,
          method: 'POST',
          url: expect.stringContaining('/test-dependencies'),
        });
        expect(actual).toEqual(expected);
      });

      it('should return fingerprints when debug option is set', async () => {
        const mock = jest
          .spyOn(request, 'makeRequest')
          .mockResolvedValue(testResult);
        const expected = TestCommandResult.createHumanReadableTestCommandResult(
          debugDisplayTxt,
          stringifyTestResults,
        );
        const actual = await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
          debug: true,
        });
        expect(mock).toHaveBeenCalled();
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
  });
});
