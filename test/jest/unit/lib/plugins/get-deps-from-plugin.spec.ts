import { getDepsFromPlugin } from '../../../../../src/lib/plugins/get-deps-from-plugin';
import { Options, TestOptions } from '../../../../../src/lib/types';
import * as singlePluginResult from '../../../../../src/lib/plugins/get-single-plugin-result';
import * as detect from '../../../../../src/lib/detect';

jest.mock('../../../../../src/lib/plugins/get-single-plugin-result');
jest.mock('../../../../../src/lib/detect', () => ({
  ...jest.requireActual('../../../../../src/lib/detect'),
  detectPackageFile: jest.fn().mockReturnValue('package.json'),
}));

describe('getDepsFromPlugin - print-effective-graph-with-errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseOptions: Options & TestOptions = {
    path: '/test',
    packageManager: 'npm',
    file: 'package.json',
    showVulnPaths: 'some',
  };

  it('should return failedResults when plugin throws and flag is set', async () => {
    const pluginError = new Error('missing lockfile');
    (
      singlePluginResult.getSinglePluginResult as jest.Mock
    ).mockRejectedValue(pluginError);

    const options = {
      ...baseOptions,
      'print-effective-graph-with-errors': true,
    };

    const result = await getDepsFromPlugin('/test', options);

    expect(result.scannedProjects).toEqual([]);
    expect((result as any).failedResults).toHaveLength(1);
    expect((result as any).failedResults[0]).toEqual({
      targetFile: 'package.json',
      error: pluginError,
      errMessage: 'missing lockfile',
    });
  });

  it('should rethrow when plugin throws and flag is not set', async () => {
    const pluginError = new Error('missing lockfile');
    (
      singlePluginResult.getSinglePluginResult as jest.Mock
    ).mockRejectedValue(pluginError);

    await expect(
      getDepsFromPlugin('/test', baseOptions),
    ).rejects.toThrow('missing lockfile');
  });

  it('should use fallback message when error has no message', async () => {
    (
      singlePluginResult.getSinglePluginResult as jest.Mock
    ).mockRejectedValue({ code: 'UNKNOWN' });

    const options = {
      ...baseOptions,
      'print-effective-graph-with-errors': true,
    };

    const result = await getDepsFromPlugin('/test', options);

    expect((result as any).failedResults[0].errMessage).toBe(
      'Something went wrong getting dependencies',
    );
  });
});
