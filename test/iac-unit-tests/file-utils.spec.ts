import { extractBundle } from '../../src/cli/commands/test/iac-local-execution/file-utils';

describe('extractBundle', () => {
  const { PassThrough } = require('stream');
  jest.mock('fs');

  it('fails to write the file on disk', () => {
    const mockReadable = new PassThrough();
    const mockError = new Error('A stream error');

    const actualPromise = extractBundle(mockReadable);
    setTimeout(() => {
      mockReadable.emit('error', mockError);
    }, 100);

    expect(actualPromise).rejects.toThrow(mockError);
  });

  it('resolves data successfully', () => {
    const mockReadable = new PassThrough();

    const actualPromise = extractBundle(mockReadable);

    setTimeout(() => {
      mockReadable.emit('data', 'this-is-a-file-chunk');
      mockReadable.emit('end');
    }, 100);

    expect(actualPromise).resolves.toEqual(undefined);
  });
});
