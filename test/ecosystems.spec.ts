import { Options } from '../src/lib/types';
import * as cppPlugin from 'snyk-cpp-plugin';
import * as path from 'path';
import * as fs from 'fs';
import { getPlugin, getEcosystem, testEcosystem } from '../src/lib/ecosystems';
import { TestCommandResult } from '../src/cli/commands/types';

describe('ecosystems', () => {
  describe('getPlugin', () => {
    it('should return c++ plugin when cpp ecosystem is given', () => {
      const actual = getPlugin('cpp');
      const expected = cppPlugin;
      expect(actual).toBe(expected);
    });

    it('should return undefined when ecosystem is not supported', () => {
      const actual = getPlugin('unsupportedEcosystem' as any);
      const expected = undefined;
      expect(actual).toBe(expected);
    });
  });

  describe('getEcosystem', () => {
    it('should return c++ ecosystem when options source is true', () => {
      const options: Options = {
        source: true,
        path: '',
      };
      const actual = getEcosystem(options);
      const expected = 'cpp';
      expect(actual).toBe(expected);
    });

    it('should return null when options source is false', () => {
      const options: Options = {
        source: false,
        path: '',
      };
      const actual = getEcosystem(options);
      const expected = null;
      expect(actual).toBe(expected);
    });
  });

  describe('testEcosystem', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'cpp-project');
    const cwd = process.cwd();

    function readFixture(filename: string) {
      const filePath = path.join(fixturePath, filename);
      return fs.readFileSync(filePath, 'utf-8');
    }

    beforeAll(() => {
      process.chdir(fixturePath);
    });
    afterAll(() => {
      process.chdir(cwd);
    });

    it('should return human readable result when no json option given', async () => {
      const display = readFixture('display.txt');
      const scan = readFixture('scan.json');
      const stringifiedData = JSON.stringify(JSON.parse(scan), null, 2);
      const expected = TestCommandResult.createHumanReadableTestCommandResult(
        display,
        stringifiedData,
      );
      const actual = await testEcosystem('cpp', ['.'], { path: '' });
      expect(actual).toEqual(expected);
    });

    it('should return json result when json option', async () => {
      const scan = readFixture('scan.json');
      const stringifiedData = JSON.stringify(JSON.parse(scan), null, 2);
      const expected = TestCommandResult.createJsonTestCommandResult(
        stringifiedData,
      );
      const actual = await testEcosystem('cpp', ['.'], {
        path: '',
        json: true,
      });
      expect(actual).toEqual(expected);
    });
  });
});
