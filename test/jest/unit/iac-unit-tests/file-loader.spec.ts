const mockFs = require('mock-fs');
import * as path from 'path';
import {
  FailedToLoadFileError,
  loadFiles,
  NoFilesToScanError,
} from '../../../../src/cli/commands/test/iac-local-execution/file-loader';
import * as fileLoader from '../../../../src/cli/commands/test/iac-local-execution/file-loader';
import {
  anotherK8sFileStub,
  anotherNonIacFileStub,
  anotherTerraformFileStub,
  emptyDirectory,
  k8sDirectory,
  k8sFileStub,
  nonIacFileStub,
  terraformDirectory,
  terraformFileStub,
  level1Directory,
  level2Directory,
  level2FileStub,
  level3Directory,
  level3FileStub,
} from './file-loader.fixtures';

describe('loadFiles', () => {
  afterEach(mockFs.restore);

  describe('single file path', () => {
    describe('with a k8s file', () => {
      it('returns an array with a single file', async () => {
        mockFs({ [k8sFileStub.filePath]: k8sFileStub.fileContent });
        const loadedFiles = await loadFiles(k8sFileStub.filePath);
        expect(loadedFiles).toContainEqual(k8sFileStub);
      });
    });

    describe('with a terraform file', () => {
      it('returns an array with a single file', async () => {
        mockFs({ [terraformFileStub.filePath]: terraformFileStub.fileContent });
        const loadedFiles = await loadFiles(terraformFileStub.filePath);
        expect(loadedFiles).toContainEqual(terraformFileStub);
      });
    });

    describe('errors', () => {
      it('throws an error when there is no valid iac file', async () => {
        mockFs({ [nonIacFileStub.filePath]: nonIacFileStub.fileContent });
        await expect(loadFiles(nonIacFileStub.filePath, {})).rejects.toThrow(
          NoFilesToScanError,
        );
      });

      it('throws an error when an error occurs when loading files', async () => {
        jest.spyOn(fileLoader, 'tryLoadFileData').mockImplementation(() => {
          throw FailedToLoadFileError;
        });

        const loadFilesFn = loadFiles(anotherK8sFileStub.filePath);

        await expect(loadFilesFn).rejects.toThrow(FailedToLoadFileError);
      });
    });
  });

  describe('directory path', () => {
    describe('with kubernetes files', () => {
      it('returns an array of files', async () => {
        mockFs({
          [k8sFileStub.filePath]: k8sFileStub.fileContent,
          [anotherK8sFileStub.filePath]: anotherK8sFileStub.fileContent,
        });

        const loadedFiles = await loadFiles(k8sDirectory);
        expect(loadedFiles).toEqual([k8sFileStub, anotherK8sFileStub]);
      });
    });

    describe('with terraform files', () => {
      it('returns an array of files', async () => {
        mockFs({
          [terraformFileStub.filePath]: terraformFileStub.fileContent,
          [anotherTerraformFileStub.filePath]:
            anotherTerraformFileStub.fileContent,
        });

        const loadedFiles = await loadFiles(terraformDirectory);
        expect(loadedFiles).toEqual([
          terraformFileStub,
          anotherTerraformFileStub,
        ]);
      });
    });

    describe('with nested files inside multiple-level directories', () => {
      beforeEach(() => {
        mockFs({
          [level1Directory]: {
            [path.basename(level2Directory)]: {
              [path.basename(
                level2FileStub.filePath,
              )]: level2FileStub.fileContent,
              [path.basename(level3Directory)]: {
                [path.basename(
                  level3FileStub.filePath,
                )]: level3FileStub.fileContent,
              },
            },
          },
        });
      });

      describe('with detectionDepth 1', () => {
        it('throws an error as there are no files at that level', async () => {
          await expect(
            loadFiles(level1Directory, {
              detectionDepth: 1,
            }),
          ).rejects.toThrow(NoFilesToScanError);
        });
      });

      describe('with detectionDepth 2', () => {
        it('returns the files at level 2', async () => {
          const loadedFiles = await loadFiles(level1Directory, {
            detectionDepth: 2,
          });
          expect(loadedFiles).toEqual([level2FileStub]);
        });
      });

      describe('with detectionDepth 3', () => {
        it('returns the files at level 2 and level 3', async () => {
          const loadedFiles = await loadFiles(level1Directory);
          expect(loadedFiles).toEqual([level3FileStub, level2FileStub]);
        });
      });

      describe('with detectionDepth 4', () => {
        it('returns the files at level 2 and level 3', async () => {
          const loadedFiles = await loadFiles(level1Directory);
          expect(loadedFiles).toEqual([level3FileStub, level2FileStub]);
        });
      });
    });

    describe('with no files', () => {
      it('throws an error', async () => {
        mockFs({
          [emptyDirectory]: {},
        });

        await expect(loadFiles(nonIacFileStub.filePath, {})).rejects.toThrow(
          NoFilesToScanError,
        );
      });
    });

    describe('with a mix of iac files and others', () => {
      it('returns only the valid iac files', async () => {
        mockFs({
          [nonIacFileStub.filePath]: nonIacFileStub.fileContent,
          [anotherNonIacFileStub.filePath]: anotherNonIacFileStub.fileContent,
          [k8sFileStub.filePath]: k8sFileStub.fileContent,
          [anotherK8sFileStub.filePath]: anotherK8sFileStub.fileContent,
          [terraformFileStub.filePath]: terraformFileStub.fileContent,
          [anotherTerraformFileStub.filePath]:
            anotherTerraformFileStub.fileContent,
        });

        const loadedFiles = await loadFiles('.');
        expect(loadedFiles).toEqual([
          k8sFileStub,
          anotherK8sFileStub,
          terraformFileStub,
          anotherTerraformFileStub,
        ]);

        expect(loadedFiles).not.toContain([
          nonIacFileStub,
          anotherNonIacFileStub,
        ]);
      });
    });
  });
});
