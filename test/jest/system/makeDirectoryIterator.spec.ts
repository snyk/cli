import { makeDirectoryIterator } from '../../../src/lib/iac/makeDirectoryIterator';
import * as path from 'path';

describe('makeDirectoryIterator', () => {
  const fixturePath = path.join(
    __dirname,
    '../../fixtures/iac/depth_detection',
  );

  it('iterates over all files in the directory tree', () => {
    const it = makeDirectoryIterator(fixturePath);
    const result = Array.from(it);

    expect(result).toEqual([
      expect.stringContaining('one.tf'),
      expect.stringContaining('five.tf'),
      expect.stringContaining('six.tf'),
      expect.stringContaining('four.tf'),
      expect.stringContaining('three.tf'),
      expect.stringContaining('two.tf'),
      expect.stringContaining('root.tf'),
    ]);
  });

  it('includes dotfiles when the includeDotfiles flag is provided', () => {
    const it = makeDirectoryIterator(fixturePath, { includeDotfiles: true });
    const result = Array.from(it);

    expect(result).toEqual([
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
    const it = makeDirectoryIterator(fixturePath, { maxDepth: 3 });
    const result = Array.from(it);

    expect(result).toEqual([
      expect.stringContaining('one.tf'),
      expect.stringContaining('two.tf'),
      expect.stringContaining('root.tf'),
    ]);
  });

  it('throws an error if the path provided is not a directory', () => {
    const it = makeDirectoryIterator('missing_path');
    expect(() => Array.from(it)).toThrowError();
  });
});
