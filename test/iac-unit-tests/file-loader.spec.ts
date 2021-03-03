const mockFs = require('mock-fs');
import { loadFiles } from '../../src/cli/commands/test/iac-local-execution/file-loader';
import {
  k8sFileStub,
  anotherK8sFileStub,
  terraformFileStub,
  anotherTerraformFileStub,
  nonIacFileStub,
  anotherNonIacFileStub,
  k8sDirectory,
  terraformDirectory,
  emptyDirectory,
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

    describe('with a non iac file', () => {
      it('throws an error', async () => {
        mockFs({ [nonIacFileStub.filePath]: nonIacFileStub.fileContent });
        await expect(loadFiles(nonIacFileStub.filePath)).rejects.toThrow(
          "Couldn't find valid IaC files",
        );
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

    describe('with no files', () => {
      it('throws an error', async () => {
        mockFs({
          [emptyDirectory]: {},
        });

        await expect(loadFiles(nonIacFileStub.filePath)).rejects.toThrow(
          "Couldn't find valid IaC files",
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

        const loadedFiles = await loadFiles('./');
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
