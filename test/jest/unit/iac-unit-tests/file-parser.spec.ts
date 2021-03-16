import { parseFiles } from '../../../../src/cli/commands/test/iac-local-execution/file-parser';
import {
  expectedKubernetesParsingResult,
  expectedTerraformParsingResult,
  kubernetesFileDataStub,
  terraformFileDataStub,
  invalidK8sFileDataStub,
  expectedInvalidK8sFileParsingResult,
} from './file-parser.fixtures';

const filesToParse = [kubernetesFileDataStub, terraformFileDataStub];

describe('parseFiles', () => {
  it('parses iac files as expected', async () => {
    const { parsedFiles, failedFiles } = await parseFiles(filesToParse);
    expect(parsedFiles[0]).toEqual(expectedKubernetesParsingResult);
    expect(parsedFiles[1]).toEqual(expectedTerraformParsingResult);
    expect(failedFiles.length).toEqual(0);
  });

  it('throws an error if a single file parse fails', async () => {
    await expect(parseFiles([invalidK8sFileDataStub])).rejects.toThrow(
      'Invalid K8s File!',
    );
  });

  it('does not throw an error if a file parse failed in a directory scan', async () => {
    const { parsedFiles, failedFiles } = await parseFiles([
      kubernetesFileDataStub,
      invalidK8sFileDataStub,
    ]);
    expect(parsedFiles.length).toEqual(1);
    expect(parsedFiles[0]).toEqual(expectedKubernetesParsingResult);
    expect(failedFiles.length).toEqual(1);
    expect(failedFiles[0]).toEqual(expectedInvalidK8sFileParsingResult);
  });
});
