import { CLI, ProblemError } from '@snyk/error-catalog-nodejs-public';
import { CustomError } from '../../../../../src/lib/errors';
import { FailedProjectScanError } from '../../../../../src/lib/plugins/get-multi-plugin-result';
import {
  getOrCreateErrorCatalogError,
  getRequestConcurrency,
} from '../../../../../src/lib/snyk-test/common';

describe('getOrCreateErrorCatalogError', () => {
  const defaultErrMessage = 'Default error message';

  it('returns the same ProblemError when error is already a ProblemError', () => {
    const problemError = new CLI.GeneralCLIFailureError(
      'Original problem error',
    );
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: problemError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBe(problemError);
    expect(result).toBeInstanceOf(ProblemError);
  });

  it('returns errorCatalog from CustomError when it exists', () => {
    const errorCatalog = new CLI.GeneralCLIFailureError(
      'Error catalog message',
    );
    const customError = new CustomError('Custom error message');
    customError.errorCatalog = errorCatalog;
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: customError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBe(errorCatalog);
  });

  it('creates GeneralCLIFailureError with userMessage from CustomError when errorCatalog is undefined', () => {
    const customError = new CustomError('Custom error message');
    customError.userMessage = 'User facing message';
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: customError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe('User facing message');
  });

  it('creates GeneralCLIFailureError with message from CustomError when userMessage is undefined', () => {
    const customError = new CustomError('Custom error message');
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: customError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe('Custom error message');
  });

  it('creates GeneralCLIFailureError with empty message when CustomError has empty message', () => {
    const customError = new CustomError('');
    customError.userMessage = undefined;
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: customError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe('');
  });

  it('creates GeneralCLIFailureError with errMessage when error is undefined', () => {
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: undefined,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe(defaultErrMessage);
  });

  it('creates GeneralCLIFailureError with errMessage when error is a generic Error', () => {
    const genericError = new Error('Generic error message');
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: genericError,
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe(defaultErrMessage);
  });

  it('includes targetFile in FailedProjectScanError when provided', () => {
    const failedProjectScanError: FailedProjectScanError = {
      errMessage: defaultErrMessage,
      error: undefined,
      targetFile: 'package.json',
    };

    const result = getOrCreateErrorCatalogError(failedProjectScanError);

    expect(result).toBeInstanceOf(ProblemError);
    expect(result.detail).toBe(defaultErrMessage);
  });
});

describe('getRequestConcurrency', () => {
  const originalValue = process.env.SNYK_REQUEST_CONCURRENCY;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.SNYK_REQUEST_CONCURRENCY;
    } else {
      process.env.SNYK_REQUEST_CONCURRENCY = originalValue;
    }
  });

  it('returns the default of 10 when SNYK_REQUEST_CONCURRENCY is unset', () => {
    delete process.env.SNYK_REQUEST_CONCURRENCY;
    expect(getRequestConcurrency()).toBe(10);
  });

  it('returns the default of 10 when SNYK_REQUEST_CONCURRENCY is empty', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '';
    expect(getRequestConcurrency()).toBe(10);
  });

  it('returns the parsed value when SNYK_REQUEST_CONCURRENCY is a valid integer', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '15';
    expect(getRequestConcurrency()).toBe(15);
  });

  it('clamps to the maximum of 50 when SNYK_REQUEST_CONCURRENCY exceeds the cap', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '500';
    expect(getRequestConcurrency()).toBe(50);
  });

  it('returns the default when SNYK_REQUEST_CONCURRENCY is below the minimum', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '0';
    expect(getRequestConcurrency()).toBe(10);
  });

  it('returns the default when SNYK_REQUEST_CONCURRENCY is negative', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '-5';
    expect(getRequestConcurrency()).toBe(10);
  });

  it('returns the default when SNYK_REQUEST_CONCURRENCY is non-numeric', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = 'abc';
    expect(getRequestConcurrency()).toBe(10);
  });

  it('honors the minimum boundary', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '1';
    expect(getRequestConcurrency()).toBe(1);
  });

  it('honors the maximum boundary', () => {
    process.env.SNYK_REQUEST_CONCURRENCY = '50';
    expect(getRequestConcurrency()).toBe(50);
  });
});
