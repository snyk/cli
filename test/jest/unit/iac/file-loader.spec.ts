import * as mockFs from 'mock-fs';
import {
  FailedToLoadFileError,
  loadContentForFiles,
} from '../../../../src/cli/commands/test/iac/local-execution/file-loader';
import * as fileLoader from '../../../../src/cli/commands/test/iac/local-execution/file-loader';
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
    afterEach(jest.restoreAllMocks);

    it('throws an error when an error occurs when loading files', async () => {
      jest.spyOn(fileLoader, 'tryLoadFileData').mockImplementation(() => {
        throw FailedToLoadFileError;
      });

      const loadFilesFn = loadContentForFiles([anotherK8sFileStub.filePath]);

      await expect(loadFilesFn).rejects.toThrow(FailedToLoadFileError);
    });
  });
});

describe('tryLoadFileData', () => {
  // In UTF-8, a BOM is useless because there is no need to signal a specific
  // byte ordering. Some operating systems and editors, though, still prepend a
  // BOM to files encoded in UTF-8. The BOM for UTF-8 is encoded by the bytes
  // contained in the following buffer. When reading a file encoded as UTF-8
  // with BOM, Node.js generates a string encoded in UTF-16 with BOM. The BOM
  // for UTF-16 is encoded by the unicode code point U+FEFF. For more details,
  // see https://en.wikipedia.org/wiki/Byte_order_mark.

  const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

  afterEach(mockFs.restore);

  it('should load a file without BOM', async () => {
    mockFs({ file: Buffer.from('data') });
    const result = await fileLoader.tryLoadFileData('file');
    expect(result.fileContent).toBe('data');
  });

  it('should load a file with BOM', async () => {
    mockFs({ file: Buffer.concat([UTF8_BOM, Buffer.from('data')]) });
    const result = await fileLoader.tryLoadFileData('file');
    expect(result.fileContent).toBe('data');
  });
});
