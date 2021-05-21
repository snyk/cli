import {
  FailedToDetectJsonConfigError,
  InvalidJsonFileError,
  InvalidYamlFileError,
  UnsupportedFileTypeError,
  parseFiles,
} from '../../../../src/cli/commands/test/iac-local-execution/file-parser';
import { FailedToDetectYamlConfigError } from '../../../../src/cli/commands/test/iac-local-execution/parsers/k8s-or-cloudformation-parser';
import {
  FailedToParseTerraformFileError,
  tryParsingTerraformFile,
} from '../../../../src/cli/commands/test/iac-local-execution/parsers/terraform-file-parser';
import {
  expectedKubernetesYamlInvalidParsingResult,
  expectedKubernetesYamlParsingResult,
  expectedTerraformParsingResult,
  expectedTerraformJsonParsingResult,
  kubernetesYamlInvalidFileDataStub,
  kubernetesYamlFileDataStub,
  terraformFileDataStub,
  invalidTerraformFileDataStub,
  terraformPlanDataStub,
  terraformPlanMissingFieldsDataStub,
  kubernetesJsonFileDataStub,
  expectedKubernetesJsonParsingResult,
  multipleKubernetesYamlsFileDataStub,
  expectedMultipleKubernetesYamlsParsingResult,
  invalidYamlFileDataStub,
  invalidJsonFileDataStub,
} from './file-parser.fixtures';
import { IacFileData } from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacFileTypes } from '../../../../dist/lib/iac/constants';
import { detectConfigType } from '../../../../src/cli/commands/test/iac-local-execution/parsers/k8s-or-cloudformation-parser';
import {
  cloudFormationJSONFileDataStub,
  cloudFormationYAMLFileDataStub,
  expectedCloudFormationJSONParsingResult,
  expectedCloudFormationYAMLParsingResult,
} from './file-parser.cloudformation.fixtures';

const filesToParse: IacFileData[] = [
  kubernetesYamlFileDataStub,
  kubernetesJsonFileDataStub,
  terraformFileDataStub,
  terraformPlanDataStub,
  multipleKubernetesYamlsFileDataStub,
  cloudFormationYAMLFileDataStub,
  cloudFormationJSONFileDataStub,
];

describe('parseFiles', () => {
  it('parses multiple iac files as expected', async () => {
    const { parsedFiles, failedFiles } = await parseFiles(filesToParse);
    expect(parsedFiles[0]).toEqual(expectedKubernetesYamlParsingResult);
    expect(parsedFiles[1]).toEqual(expectedKubernetesJsonParsingResult);
    expect(parsedFiles[2]).toEqual(expectedTerraformParsingResult);
    expect(parsedFiles[3]).toEqual(expectedTerraformJsonParsingResult);
    expect(parsedFiles[4]).toEqual(
      expectedMultipleKubernetesYamlsParsingResult,
    );
    expect(parsedFiles[5]).toEqual({
      ...expectedMultipleKubernetesYamlsParsingResult,
      docId: 1,
    });
    expect(parsedFiles[6]).toEqual(expectedCloudFormationYAMLParsingResult);
    expect(parsedFiles[7]).toEqual(expectedCloudFormationJSONParsingResult);
    expect(failedFiles.length).toEqual(0);
  });

  it('throws an error for YAML file with missing fields for Kubernetes file', async () => {
    await expect(
      parseFiles([kubernetesYamlInvalidFileDataStub]),
    ).rejects.toThrow(FailedToDetectYamlConfigError);
  });

  it('throws an error for JSON file with missing fields for Kubernetes file', async () => {
    await expect(
      parseFiles([
        {
          ...kubernetesYamlInvalidFileDataStub,
          fileType: 'json',
        },
      ]),
    ).rejects.toThrow(FailedToDetectJsonConfigError);
  });

  it('throws an error for JSON file with missing fields for Terraform Plan', async () => {
    await expect(
      parseFiles([terraformPlanMissingFieldsDataStub]),
    ).rejects.toThrow(FailedToDetectJsonConfigError);
  });

  it('does not throw an error if a file parse failed in a directory scan', async () => {
    const { parsedFiles, failedFiles } = await parseFiles([
      kubernetesYamlFileDataStub,
      kubernetesYamlInvalidFileDataStub,
    ]);
    expect(parsedFiles.length).toEqual(1);
    expect(parsedFiles[0]).toEqual(expectedKubernetesYamlParsingResult);
    expect(failedFiles.length).toEqual(1);
    expect(failedFiles[0]).toEqual(expectedKubernetesYamlInvalidParsingResult);
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

  it('throws an error for invalid YAML file types', async () => {
    await expect(parseFiles([invalidYamlFileDataStub])).rejects.toThrow(
      InvalidYamlFileError,
    );
  });

  it('throws an error for a Helm file', async () => {
    const helmFileData: IacFileData = {
      fileContent: ' {{ something }}',
      filePath: 'path/to/file',
      fileType: 'yaml',
    };

    expect(() => detectConfigType(helmFileData, [{}])).toThrowError(
      'Failed to parse Helm file',
    );
  });

  it('throws an error for an invalid HCL file', async () => {
    expect(() => tryParsingTerraformFile(invalidTerraformFileDataStub)).toThrow(
      FailedToParseTerraformFileError,
    );
  });
});
