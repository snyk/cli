import * as fileParser from '../../../../src/cli/commands/test/iac-local-execution/file-parser';
import {
  parseFiles,
  UnsupportedFileTypeError,
} from '../../../../src/cli/commands/test/iac-local-execution/file-parser';
import * as k8sParser from '../../../../src/cli/commands/test/iac-local-execution/parsers/kubernetes-parser';
import {
  HelmFileNotSupportedError,
  MissingRequiredFieldsInKubernetesYamlError,
} from '../../../../src/cli/commands/test/iac-local-execution/parsers/kubernetes-parser';
import {
  expectedInvalidK8sFileParsingResult,
  expectedKubernetesParsingResult,
  expectedTerraformParsingResult,
  invalidK8sFileDataStub,
  kubernetesFileDataStub,
  terraformFileDataStub,
} from './file-parser.fixtures';
import { IacFileData } from '../../../../src/cli/commands/test/iac-local-execution/types';
import { tryParsingKubernetesFile } from '../../../../dist/cli/commands/test/iac-local-execution/parsers/kubernetes-parser';
import { IacFileTypes } from '../../../../dist/lib/iac/constants';
import {
  MissingRequiredFieldsInTerraformPlanError,
  tryParsingTerraformPlan,
} from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-plan-parser';
import { iacFileDataWithoutResourceChanges } from './terraform-plan-parser.fixtures';

const filesToParse: IacFileData[] = [
  kubernetesFileDataStub,
  terraformFileDataStub,
];

describe('parseFiles', () => {
  it('parses iac files as expected', async () => {
    const { parsedFiles, failedFiles } = await parseFiles(filesToParse);
    expect(parsedFiles[0]).toEqual(expectedKubernetesParsingResult);
    expect(parsedFiles[1]).toEqual(expectedTerraformParsingResult);
    expect(failedFiles.length).toEqual(0);
  });

  it('throws an error if a single file parse fails', async () => {
    await expect(parseFiles([invalidK8sFileDataStub])).rejects.toThrow(
      MissingRequiredFieldsInKubernetesYamlError,
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

  it('throws an error for unsupported file types', async () => {
    jest.spyOn(fileParser, 'tryParseIacFile').mockImplementation(() => {
      throw UnsupportedFileTypeError;
    });

    const parseFilesFn = parseFiles([
      {
        fileContent: 'file.java',
        filePath: 'path/to/file',
        fileType: 'java' as IacFileTypes,
      },
    ]);

    await expect(parseFilesFn).rejects.toThrow(UnsupportedFileTypeError);
  });

  it('throws an error for a Helm file', async () => {
    const helmFileData: IacFileData = {
      fileContent: ' {{ something }}',
      filePath: 'path/to/file',
      fileType: 'yaml',
    };

    expect(() => tryParsingKubernetesFile(helmFileData)).toThrowError(
      'Failed to parse Helm file',
    );
  });
});
