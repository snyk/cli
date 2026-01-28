import {
  extractBundle,
  makeFileAndDirectoryGenerator,
  createPathExclusionMatcher,
} from '../../../../src/cli/commands/test/iac/local-execution/file-utils';
import * as tar from 'tar';
import { PassThrough } from 'stream';
import { LOCAL_POLICY_ENGINE_DIR } from '../../../../src/cli/commands/test/iac/local-execution/local-cache';
import * as path from 'path';
import { ExcludeFlagInvalidInputError } from '../../../../src/lib/errors/exclude-flag-invalid-input';

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

  it('prunes the directory tree when an exclusion matcher is provided', () => {
    const isExcluded = createPathExclusionMatcher('one');

    const it = makeFileAndDirectoryGenerator(
      fixturePath,
      undefined,
      isExcluded,
    );
    const results = Array.from(it);

    const files = results
      .filter((r) => r.file?.fileName !== undefined)
      .map((r) => r.file?.fileName);

    const directories = results
      .filter((r) => r.directory !== undefined)
      .map((r) => r.directory);

    expect(files).not.toContainEqual(expect.stringContaining('five.tf'));
    expect(files).not.toContainEqual(expect.stringContaining('six.tf'));
    expect(files).not.toContainEqual(expect.stringContaining('one.tf'));

    expect(directories).not.toContainEqual(expect.stringContaining('/one'));

    expect(files).toContainEqual(expect.stringContaining('root.tf'));
    expect(files).toContainEqual(expect.stringContaining('hidden.tf'));
  });

  it('does not exclude the root path if it happens to match the exclude name partially', () => {
    const isExcluded = createPathExclusionMatcher('depth');
    const it = makeFileAndDirectoryGenerator(
      fixturePath,
      undefined,
      isExcluded,
    );

    const results = Array.from(it);

    expect(results.length).toBeGreaterThan(0);
    // The first yielded item should be the root fixture path itself.
    expect(results[0].directory).toBe(fixturePath);

    const hasRootTf = results.some((r) => r.file?.fileName.endsWith('root.tf'));
    expect(hasRootTf).toBe(true);
  });
});

describe('createPathExclusionMatcher', () => {
  it('returns a matcher that returns false for everything when input is undefined or empty', () => {
    const isExcludedUndefined = createPathExclusionMatcher(undefined as any);
    expect(isExcludedUndefined('any/path/file.tf')).toBe(false);

    const isExcludedEmpty = createPathExclusionMatcher('');
    expect(isExcludedEmpty('any/path/file.tf')).toBe(false);

    const isExcludedSpace = createPathExclusionMatcher('   ');
    expect(isExcludedSpace('any/path/file.tf')).toBe(false);
  });

  it('handles spaces between comma-separated values', () => {
    const isExcluded = createPathExclusionMatcher(' node_modules ,  temp ');
    expect(isExcluded('node_modules')).toBe(true);
    expect(isExcluded('temp')).toBe(true);
  });

  it('matches files/directories by basename at any depth', () => {
    const isExcluded = createPathExclusionMatcher('node_modules,temp');

    expect(isExcluded('node_modules')).toBe(true);
    expect(isExcluded('src/project/node_modules')).toBe(true);
    expect(isExcluded('src/project/node_modules/axios/index.js')).toBe(true);
    expect(isExcluded('src/temp')).toBe(true);

    expect(isExcluded('src/index.tf')).toBe(false);
    expect(isExcluded('node_modules_suffix')).toBe(false);
  });

  it('throws ExcludeFlagInvalidInputError if a path separator is provided', () => {
    expect(() => createPathExclusionMatcher('src/utils')).toThrow(
      ExcludeFlagInvalidInputError,
    );
    expect(() => createPathExclusionMatcher('subfolder\\path')).toThrow(
      ExcludeFlagInvalidInputError,
    );
  });
});
