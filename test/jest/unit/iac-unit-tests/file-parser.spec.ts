import {
  UnsupportedFileTypeError,
  parseFiles,
} from '../../../../src/cli/commands/test/iac-local-execution/file-parser';
import { NoFilesToScanError } from '../../../../src/cli/commands/test/iac-local-execution/file-loader';
import {
  FailedToParseTerraformFileError,
  tryParsingTerraformFile,
} from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-file-parser';
import {
  expectedKubernetesYamlParsingResult,
  expectedTerraformParsingResult,
  expectedTerraformJsonParsingResult,
  kubernetesYamlInvalidFileDataStub,
  kubernetesYamlFileDataStub,
  terraformFileDataStub,
  invalidTerraformFileDataStub,
  terraformPlanDataStub,
  kubernetesJsonFileDataStub,
  expectedKubernetesJsonParsingResult,
  multipleKubernetesYamlsFileDataStub,
  expectedMultipleKubernetesYamlsParsingResult,
  invalidYamlFileDataStub,
  unrecognisedYamlDataStub,
  invalidJsonFileDataStub,
  duplicateKeyYamlErrorFileDataStub,
  expectedDuplicateKeyYamlErrorFileParsingResult,
  expectedInsufficientIndentationYamlErrorFileParsingResult,
  insufficientIndentationYamlErrorFileDataStub,
  armJsonFileDataStub,
  expectedArmParsingResult,
  armJsonInvalidFileDataStub,
} from './file-parser.fixtures';
import { IacFileData } from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacFileTypes } from '../../../../dist/lib/iac/constants';
import {
  cloudFormationJSONFileDataStub,
  cloudFormationYAMLFileDataStub,
  expectedCloudFormationJSONParsingResult,
  expectedCloudFormationYAMLParsingResult,
} from './file-parser.cloudformation.fixtures';
import {
  InvalidJsonFileError,
  InvalidYamlFileError,
} from '../../../../src/cli/commands/test/iac-local-execution/yaml-parser';

const filesToParse: IacFileData[] = [
  kubernetesYamlFileDataStub,
  kubernetesJsonFileDataStub,
  terraformFileDataStub,
  terraformPlanDataStub,
  unrecognisedYamlDataStub,
  multipleKubernetesYamlsFileDataStub,
  cloudFormationYAMLFileDataStub,
  cloudFormationJSONFileDataStub,
  armJsonFileDataStub,
];

describe('parseFiles', () => {
  it('parses multiple iac files as expected, skipping unrecognised schemas', async () => {
    const { parsedFiles, failedFiles } = await parseFiles(filesToParse);
    expect(parsedFiles.length).toEqual(9);
    expect(parsedFiles[0]).toEqual(expectedKubernetesYamlParsingResult);
    expect(parsedFiles[1]).toEqual(expectedKubernetesJsonParsingResult);
    expect(parsedFiles[2]).toEqual(expectedTerraformParsingResult);
    expect(parsedFiles[3]).toEqual(expectedTerraformJsonParsingResult);
    expect(parsedFiles[4]).toEqual(
      expectedMultipleKubernetesYamlsParsingResult,
    );
    expect(parsedFiles[5]).toEqual({
      ...expectedMultipleKubernetesYamlsParsingResult,
      docId: 2, // doc, the 2nd doc, is an empty doc, which is ignored. There is also an ignored docId:3.
    });
    expect(parsedFiles[6]).toEqual(expectedCloudFormationYAMLParsingResult);
    expect(parsedFiles[7]).toEqual(expectedCloudFormationJSONParsingResult);
    expect(parsedFiles[8]).toEqual(expectedArmParsingResult);
    expect(failedFiles.length).toEqual(0);
  });

  it('does not throw an error if a file parse failed in a directory scan', async () => {
    const { parsedFiles, failedFiles } = await parseFiles([
      kubernetesYamlFileDataStub,
      kubernetesYamlInvalidFileDataStub,
      armJsonFileDataStub,
      armJsonInvalidFileDataStub,
    ]);
    expect(parsedFiles.length).toEqual(2);
    expect(parsedFiles[0]).toEqual(expectedKubernetesYamlParsingResult);
    expect(parsedFiles[1]).toEqual(expectedArmParsingResult);
    expect(failedFiles.length).toEqual(0);
  });

  it('throws an error for unsupported file types', async () => {
    await expect(
      parseFiles([
        {
          fileContent: 'file.java',
          filePath: 'path/to/file',
          fileType: 'java' as IacFileTypes,
        },
      ]),
    ).rejects.toThrow(UnsupportedFileTypeError);
  });

  it('throws an error for invalid JSON file types', async () => {
    await expect(parseFiles([invalidJsonFileDataStub])).rejects.toThrow(
      InvalidJsonFileError,
    );
  });

  it('throws an error for invalid (syntax) YAML file types', async () => {
    await expect(parseFiles([invalidYamlFileDataStub])).rejects.toThrow(
      InvalidYamlFileError,
    );
  });

  it('does not throw an error for unrecognised config types', async () => {
    const { parsedFiles, failedFiles } = await parseFiles([
      cloudFormationYAMLFileDataStub,
      unrecognisedYamlDataStub,
    ]);
    expect(parsedFiles.length).toEqual(1);
    expect(failedFiles.length).toEqual(0);
  });

  it('throws an error when no recognised config types are found', async () => {
    await expect(parseFiles([unrecognisedYamlDataStub])).rejects.toThrow(
      NoFilesToScanError,
    );
  });

  // the npm yaml parser by default fails on SemanticErrors like duplicate keys
  // but we decided to skip this error in order to be consistent with the Policy Engine
  it.each([
    [
      {
        fileStub: duplicateKeyYamlErrorFileDataStub,
        expectedParsingResult: expectedDuplicateKeyYamlErrorFileParsingResult,
      },
    ],
    [
      {
        fileStub: insufficientIndentationYamlErrorFileDataStub,
        expectedParsingResult: expectedInsufficientIndentationYamlErrorFileParsingResult,
      },
    ],
  ])(
    `given an $fileStub with one of the errors to skip, it returns $expectedParsingResult`,
    async ({ fileStub, expectedParsingResult }) => {
      const { parsedFiles } = await parseFiles([fileStub]);
      expect(parsedFiles[0]).toEqual(expectedParsingResult);
    },
  );

  it('throws an error for an invalid HCL file', async () => {
    expect(() => tryParsingTerraformFile(invalidTerraformFileDataStub)).toThrow(
      FailedToParseTerraformFileError,
    );
  });
});
