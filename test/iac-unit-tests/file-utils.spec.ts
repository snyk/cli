import { extractBundle } from '../../src/cli/commands/test/iac-local-execution/file-utils';

describe('extractBundle', () => {
  const fs = require('fs');
  const { PassThrough } = require('stream');
  jest.mock('fs');
  const mockFilePath = '.iac-data/bundle.tar.gz';

  it('fails to write the file on disk', () => {
    const mockReadable = new PassThrough();
    const mockWriteable = new PassThrough();
    const mockError = new Error('A stream error');
    fs.createWriteStream.mockReturnValueOnce(mockWriteable);

    const actualPromise = extractBundle(mockReadable, mockFilePath);
    setTimeout(() => {
      mockReadable.emit('error', mockError);
    }, 100);

    expect(actualPromise).rejects.toThrow(mockError);
  });

  it('resolves data successfully', () => {
    const mockReadable = new PassThrough();
    const mockWriteable = new PassThrough();
    fs.createWriteStream.mockReturnValueOnce(mockWriteable);

    const actualPromise = extractBundle(mockReadable, mockFilePath);

    setTimeout(() => {
      mockReadable.emit('data', 'this-is-a-file-chunk');
      mockReadable.emit('end');
    }, 100);

    expect(actualPromise).resolves.toEqual(undefined);
  });
});
