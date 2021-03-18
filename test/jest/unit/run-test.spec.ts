import { runTest } from '../../../src/lib/snyk-test/run-test';
import * as optionsValidator from '../../../src/lib/options-validator';
import { CustomError } from '../../../src/lib/errors/custom-error';
import { Options, TestOptions } from '../../../src/lib/types';

describe('CLI runTest - propagate correct user error', () => {
  it('returns userMessage for a default error code', async () => {
    jest.spyOn(optionsValidator, 'validateOptions').mockImplementation(() => {
      const err = new CustomError('test');
      err.userMessage = 'just a random error';
      throw err;
    });

    // Dummy options in order to call to runTest
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
    };

    await expect(runTest(undefined, '', options)).rejects.toThrow(
      'just a random error',
    );
  });

  it('returns userMessage for error code 404', async () => {
    jest.spyOn(optionsValidator, 'validateOptions').mockImplementation(() => {
      const err = new CustomError('FailedToGetVulnerabilitiesError');
      err.name = 'FailedToGetVulnerabilitiesError';
      err.code = 404;
      err.userMessage = 'this is error 404';
      throw err;
    });

    // Dummy options in order to call to runTest
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
    };

    await expect(runTest(undefined, '', options)).rejects.toThrow(
      'this is error 404',
    );
  });

  it('returns right message for error code 403', async () => {
    jest.spyOn(optionsValidator, 'validateOptions').mockImplementation(() => {
      const err = new CustomError('Feature not allowed');
      err.name = 'Feature not allowed';
      err.code = 403;
      err.userMessage = 'this is error 403';
      throw err;
    });

    // Dummy options in order to call to runTest
    const options: Options & TestOptions = {
      path: '',
      traverseNodeModules: false,
      showVulnPaths: 'none',
    };

    await expect(runTest(undefined, '', options)).rejects.toThrow(
      'Could not detect supported target files',
    );
  });
});
