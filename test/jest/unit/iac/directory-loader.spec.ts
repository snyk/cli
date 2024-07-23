const mockFs = require('mock-fs');
import {
  getFilesForDirectoryGenerator,
  getAllDirectoriesForPath,
  getFilesForDirectory,
  shouldBeParsed,
} from '../../../../src/cli/commands/test/iac/local-execution/directory-loader';
import * as directoryLoader from '../../../../src/cli/commands/test/iac/local-execution/directory-loader';
import * as path from 'path';
import {
  terraformFileStub,
  level1Directory,
  level2Directory,
  level2FileStub,
  level3Directory,
  level3FileStub,
  nonIacFileStub,
} from './file-loader.fixtures';

describe('getAllDirectoriesForPath', () => {
  afterEach(() => {
    jest.resetAllMocks();
    mockFs.restore();
  });

  describe('single file path', () => {
    it('with a single .tf file', () => {
      mockFs({ [terraformFileStub.filePath]: 'content' });
      const directories = getAllDirectoriesForPath(terraformFileStub.filePath);
      expect(directories).toEqual([terraformFileStub.filePath]);
    });

    describe('with a single .tfvars file', () => {
      const fullPath = path.join(path.resolve('.'), 'file.tfvars');
      it('returns an array with a single file', () => {
        mockFs({ [fullPath]: 'some variables' });
        const filePaths = getAllDirectoriesForPath('file.tfvars');
        expect(filePaths).toEqual([fullPath]);
      });

      it('can handle single dot relative paths successfully', () => {
        mockFs({ [fullPath]: 'some variables' });
        const filePaths = getAllDirectoriesForPath('./file.tfvars');
        expect(filePaths).toEqual([fullPath]);
      });
    });
  });

  describe('errors', () => {
    it('returns an empty array if single file scan and the file is not IaC', async () => {
      mockFs({ [nonIacFileStub.filePath]: 'content' });

      expect(getAllDirectoriesForPath(nonIacFileStub.filePath)).toEqual([
        nonIacFileStub.filePath,
      ]);
      expect(
        getFilesForDirectory(nonIacFileStub.filePath, nonIacFileStub.filePath),
      ).toEqual([]);
    });

    it('throws an error when an error occurs when loading files', () => {
      jest
        .spyOn(directoryLoader, 'getAllDirectoriesForPath')
        .mockImplementation(() => {
          throw new Error('error occurred during fs operations');
        });
      expect(getAllDirectoriesForPath).toThrow(
        Error('error occurred during fs operations'),
      );
    });
  });

  describe('directory paths', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });
    describe('with just IaC files and 0 nested directories', () => {
      it('returns itself', () => {
        mockFs({
          dir: {
            ['file1.tf']: 'content',
            ['file2.tf']: 'content',
            ['file3.tfvars']: 'content',
          },
        });

        const filePaths = getAllDirectoriesForPath('dir');
        expect(filePaths).toEqual(['dir']);
      });
    });
  });

  describe('with multiple directories', () => {
    it('returns the non empty directories', () => {
      mockFs({
        dir: {
          ['file.tf']: 'content',
          'nested-dir': {
            ['file.tf']: 'something',
            ['.']: 'something',
          },
          'empty-dir': {},
        },
        ['file.tfvars']: 'content',
        'empty-dir-2': {},
      });

      const filePaths = getAllDirectoriesForPath('dir');
      expect(filePaths).toEqual(['dir', 'dir/nested-dir']);
    });

    describe('with nested files inside multiple-level directories', () => {
      beforeEach(() => {
        mockFs({
          [level1Directory]: {
            [path.basename(level2Directory)]: {
              [path.basename(level2FileStub.filePath)]:
                level2FileStub.fileContent,
              [path.basename(level3Directory)]: {
                [path.basename(level3FileStub.filePath)]:
                  level3FileStub.fileContent,
              },
            },
          },
        });
      });

      describe('with 1 directory', () => {
        describe('with 2 directories', () => {
          it('returns the files at level 2', () => {
            const directoryFilePaths =
              getAllDirectoriesForPath(level1Directory);
            const level2Dir = path.join(
              level1Directory,
              path.basename(level2Directory),
            );
            expect(directoryFilePaths).toEqual([
              level1Directory,
              level2Dir,
              path.join(level2Dir, path.basename(level3Directory)),
            ]);
          });
        });

        describe('with detection depth 1', () => {
          it('returns the files at level 1', () => {
            const directoryFilePaths = getAllDirectoriesForPath(
              level1Directory,
              1,
            );
            expect(directoryFilePaths).toEqual([
              level1Directory,
              level2Directory,
            ]);
          });
        });
      });
    });
  });

  describe('getTerraformFilesInDirectoryGenerator', () => {
    it('ignores specific filetypes', () => {
      mockFs({
        dir: {
          ['file1.tf']: 'content',
          ['file2.yaml']: 'content',
          ['.']: 'content',
          ['..']: 'content',
          ['.DS_Store']: 'content',
          ['#']: 'content',
          ['#swap#']: 'content',
          ['~']: 'content',
          ['~something']: 'content',
          ['file.tfvars']: 'content',
          ['file.auto.tfvars']: 'content',
        },
      });

      const filePaths = [...getFilesForDirectoryGenerator('dir')];
      expect(filePaths).toEqual([
        'dir/file.auto.tfvars',
        'dir/file.tfvars',
        'dir/file1.tf',
        'dir/file2.yaml',
      ]);
    });

    it('gets filepaths for the specific directory only', () => {
      mockFs({
        dir: {
          ['file1.tf']: 'content',
          ['file.tfvars']: 'content',
          nestedDir: {
            ['file-nested.tf']: 'content',
            ['file-nested.tfvars']: 'content',
          },
        },
      });

      const filePaths = [...getFilesForDirectoryGenerator('dir')];
      expect(filePaths).toEqual(['dir/file.tfvars', 'dir/file1.tf']);
    });
  });
});

describe('shouldBeParsed', () => {
  it.each([
    ['dir/file1.tf', true],
    ['dir/file2.yaml', true],
    ['dir/.', false],
    ['dir/..', false],
    ['dir/.DS_Store', false],
    ['dir/#', false],
    ['dir/#swap#', false],
    ['dir/~', false],
    ['dir/~something', false],
    ['dir/file.tfvars', true],
    ['dir/file.auto.tfvars', true],
  ])(
    'given %p filepath, returns %p for shouldBeParsed',
    (filepath, expectedResult) => {
      expect(shouldBeParsed(filepath)).toBe(expectedResult);
    },
  );
});
