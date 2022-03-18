const mockFs = require('mock-fs');
import {
  FailedToLoadFileError,
  loadContentForFiles,
} from '../../../../src/cli/commands/test/iac-local-execution/file-loader';
import * as fileLoader from '../../../../src/cli/commands/test/iac-local-execution/file-loader';
import {
  anotherK8sFileStub,
  k8sFileStub,
  nonIacFileStub,
  terraformFileStub,
} from './file-loader.fixtures';

describe('loadContentForFiles', () => {
  afterEach(mockFs.restore);

  describe('with a k8s file', () => {
    it('returns an array with a single file', async () => {
      mockFs({ [k8sFileStub.filePath]: k8sFileStub.fileContent });
      const loadedFiles = await loadContentForFiles([k8sFileStub.filePath]);
      expect(loadedFiles).toContainEqual(k8sFileStub);
    });
  });

  describe('with a terraform file', () => {
    it('returns an array with a single file', async () => {
      mockFs({ [terraformFileStub.filePath]: terraformFileStub.fileContent });
      const loadedFiles = await loadContentForFiles([
        terraformFileStub.filePath,
      ]);
      expect(loadedFiles).toContainEqual(terraformFileStub);
    });
  });

  describe('with invalid iac file', () => {
    it('returns an array with a single file', async () => {
      mockFs({ [nonIacFileStub.filePath]: nonIacFileStub.fileContent });
      const loadedFiles = await loadContentForFiles([nonIacFileStub.filePath]);
      expect(loadedFiles).toContainEqual(nonIacFileStub);
    });
  });

  describe('errors', () => {
    it('throws an error when an error occurs when loading files', async () => {
      jest.spyOn(fileLoader, 'tryLoadFileData').mockImplementation(() => {
        throw FailedToLoadFileError;
      });

      const loadFilesFn = loadContentForFiles([anotherK8sFileStub.filePath]);

      await expect(loadFilesFn).rejects.toThrow(FailedToLoadFileError);
    });
  });
});
