import { Options } from '../src/lib/types';
import * as cppPlugin from 'snyk-cpp-plugin';
import * as path from 'path';
import * as fs from 'fs';
import * as ecosystems from '../src/lib/ecosystems';
import { TestCommandResult } from '../src/cli/commands/types';

describe('ecosystems', () => {
  describe('getPlugin', () => {
    it('should return c++ plugin when cpp ecosystem is given', () => {
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
    it('should return c++ ecosystem when options source is true', () => {
      const options: Options = {
        source: true,
        path: '',
      };
      const actual = ecosystems.getEcosystem(options);
      const expected = 'cpp';
      expect(actual).toBe(expected);
    });
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
  const fixturePath = path.join(__dirname, 'fixtures', 'cpp-project');
  const cwd = process.cwd();

  function readFixture(filename: string) {
    const filePath = path.join(fixturePath, filename);
    return fs.readFileSync(filePath, 'utf-8');
  }

  beforeAll(() => {
    process.chdir(fixturePath);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    process.chdir(cwd);
  });

  it('should return human readable result when no json option given', async () => {
    const display = readFixture('display.txt');
    const testResults = readFixture('testResults.json');
    const stringifiedData = JSON.stringify(JSON.parse(testResults), null, 2);
    const expected = TestCommandResult.createHumanReadableTestCommandResult(
      display,
      stringifiedData,
    );

    const actual = await ecosystems.testEcosystem('cpp', ['.'], { path: '' });
    expect(actual).toEqual(expected);
  });

  it('should return json result when json option', async () => {
    const testResults = readFixture('testResults.json');
    const stringifiedData = JSON.stringify(JSON.parse(testResults), null, 2);
    const expected = TestCommandResult.createJsonTestCommandResult(
      stringifiedData,
    );
    const actual = await ecosystems.testEcosystem('cpp', ['.'], {
      path: '',
      json: true,
    });
    expect(actual).toEqual(expected);
  });

  it('should throw error when response code is not 200', async () => {
    const expected = { code: 401, message: 'Invalid auth token' };
    jest.spyOn(ecosystems, 'testEcosystem').mockRejectedValue(expected);
    expect.assertions(1);
    try {
      await ecosystems.testEcosystem('cpp', ['.'], {
        path: '',
      });
    } catch (error) {
      expect(error).toEqual(expected);
    }
  });

  it.skip('should return error when there was a problem testing dependencies', async () => {
    //@boost: TODO finish up my implementation
    // const makeRequestSpy = jest
    //   .spyOn(ecosystems, 'makeRequest')
    //   .mockRejectedValue('Something went wrong');
    // const ecosystemDisplaySpy = jest.spyOn(cppPlugin, 'display');
    const commandResult = await ecosystems.testEcosystem('cpp', ['.'], {
      path: '',
      json: true,
    });
    console.log(commandResult);
    expect(commandResult).toEqual('');
    // expect(ecosystemDisplaySpy).toHaveBeenCalledWith({});
  });
});
