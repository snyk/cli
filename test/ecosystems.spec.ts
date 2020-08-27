import * as fs from 'fs';
import * as path from 'path';
import * as cppPlugin from 'snyk-cpp-plugin';
import * as ecosystems from '../src/lib/ecosystems';
import * as request from '../src/lib/request/promise';
import { Options } from '../src/lib/types';
import { TestCommandResult } from '../src/cli/commands/types';

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
        const filePath = path.join(fixturePath, filename);
        return fs.readFileSync(filePath, 'utf-8');
      }

      function readJsonFixture(filename: string) {
        const contents = readFixture(filename);
        return JSON.parse(contents);
      }

      const displayTxt = readFixture('display.txt');
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
        const mock = jest
          .spyOn(request, 'makeRequest')
          .mockResolvedValue(testResult);
        const expected = TestCommandResult.createHumanReadableTestCommandResult(
          displayTxt,
          stringifyTestResults,
        );
        const actual = await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
        });
        expect(mock).toHaveBeenCalled();
        expect(actual).toEqual(expected);
      });

      it('should return json result when json option', async () => {
        const mock = jest
          .spyOn(request, 'makeRequest')
          .mockResolvedValue(testResult);
        const expected = TestCommandResult.createJsonTestCommandResult(
          stringifyTestResults,
        );
        const actual = await ecosystems.testEcosystem('cpp', ['.'], {
          path: '',
          json: true,
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
