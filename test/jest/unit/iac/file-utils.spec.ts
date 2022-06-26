import {
  extractBundle,
  makeFileAndDirectoryGenerator,
} from '../../../../src/cli/commands/test/iac/local-execution/file-utils';
import * as tar from 'tar';
import { PassThrough } from 'stream';
import { LOCAL_POLICY_ENGINE_DIR } from '../../../../src/cli/commands/test/iac/local-execution/local-cache';
import * as path from 'path';

describe('extractBundle', () => {
  jest.mock('fs');

  it('fails to write the file on disk', async () => {
    const mockReadable = new PassThrough();
    const mockError = new Error('A stream error');

    const actualPromise = extractBundle(mockReadable);
    mockReadable.emit('error', mockError);

    await expect(actualPromise).rejects.toThrow(mockError);
  });

  it('resolves data successfully', async () => {
    const tarSpy = jest.spyOn(tar, 'x');

    let receivedBundleData = '';
    const mockUntarStream = new PassThrough();
    mockUntarStream.on('data', (evt) => (receivedBundleData += evt.toString()));
    tarSpy.mockImplementation(() => mockUntarStream);

    const mockBundleStream = new PassThrough();
    const extractBundlePromise = extractBundle(mockBundleStream);
    mockBundleStream.write('zipped data');
    mockBundleStream.end();

    await expect(extractBundlePromise).resolves.toEqual(undefined);
    expect(tarSpy).toBeCalledWith({
      C: expect.stringMatching(LOCAL_POLICY_ENGINE_DIR),
    });
    expect(receivedBundleData).toEqual('zipped data');
  });
});

describe('makeFileAndDirectoryGenerator', () => {
  const fixturePath = path.join(
    __dirname,
    '../../../fixtures/iac/depth_detection',
  );

  it('iterates over all files in the directory tree, including dotfiles', () => {
    const it = makeFileAndDirectoryGenerator(fixturePath);
    const files = Array.from(it)
      .filter((result) => result.file?.fileName !== undefined)
      .map((result) => result.file?.fileName);

    expect(files).toEqual([
      expect.stringContaining('hidden.tf'),
      expect.stringContaining('.hidden.tf'),
      expect.stringContaining('one.tf'),
      expect.stringContaining('five.tf'),
      expect.stringContaining('six.tf'),
      expect.stringContaining('four.tf'),
      expect.stringContaining('three.tf'),
      expect.stringContaining('two.tf'),
      expect.stringContaining('root.tf'),
    ]);
  });

  it('limits the subdirectory depth when maxDepth option is provided', () => {
    const it = makeFileAndDirectoryGenerator(fixturePath, 3);
    const files = Array.from(it)
      .filter((result) => result.file?.fileName !== undefined)
      .map((result) => result.file?.fileName);

    expect(files).toEqual([
      expect.stringContaining('hidden.tf'),
      expect.stringContaining('.hidden.tf'),
      expect.stringContaining('one.tf'),
      expect.stringContaining('two.tf'),
      expect.stringContaining('root.tf'),
    ]);
  });

  it('throws an error if the path provided is not a directory', () => {
    const it = makeFileAndDirectoryGenerator('missing_path');
    expect(() => Array.from(it)).toThrowError();
  });
});
