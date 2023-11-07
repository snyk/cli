import * as errors from '../../../../../src/lib/errors/legacy-errors';
import { FormattedCustomError } from '../../../../../src/lib/errors';

describe('errors.message', () => {
  it('returns the error message if it is a VULNS error', () => {
    const errorMessage = 'This is an error message';
    const error = new Error(errorMessage) as any;
    (error as any).code = 'VULNS';

    const result = errors.message(error);

    expect(result).toBe(errorMessage);
  });

  it('returns the error message if there is a message and it is a FormattedCustomError', () => {
    const formattedUserMessage = 'This is a formatted user error message';
    const error = new FormattedCustomError(
      'This is an error message',
      formattedUserMessage,
    );

    const result = errors.message(error);

    expect(result).toBe(error.formattedUserMessage);
  });

  it('returns the error message based on the error code', () => {
    const error = new Error('Unauthorized') as any;
    error.code = 'Unauthorized';

    const result: string = errors.message(error);

    // comparing with toContain because the error message is formatted to be red and bold
    expect(result).toContain(
      'Unauthorized: please ensure you are logged in using `snyk auth`',
    );
  });

  it('returns the error message based on the error message (404)', () => {
    const error = new Error('404');

    const result: string = errors.message(error);

    // comparing with toContain because the error message is formatted to be red and bold
    expect(result).toContain(
      'The package could not be found or does not exist',
    );
  });

  it('returns the error message based on the error message (NOT_FOUND)', () => {
    const error = new Error('NOT_FOUND');

    const result: string = errors.message(error);

    // comparing with toContain because the error message is formatted to be red and bold
    expect(result).toContain(
      'The package could not be found or does not exist',
    );
  });

  it('returns unknown error message for unknowne error code', () => {
    const error = new Error('Bad request') as any;
    error.code = 400;

    const result = errors.message(error);

    expect(result).toBe(
      'An unknown error occurred. Please run with `-d` and include full trace when reporting to Snyk',
    );
  });

  it('returns the error message if it is not recognized', () => {
    const error = new Error('This is an unknown error');

    const result = errors.message(error);

    expect(result).toBe<string>(error.message);
  });

  it('returns the error message if it is a string', () => {
    const errorMessage = 'This is an error message';

    const result = errors.message(errorMessage);

    expect(result).toBe(errorMessage);
  });
});
