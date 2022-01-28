import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';
import * as fs from 'fs';
import * as path from 'path';
import {
  getExpectedResult,
  PlanOutputCase,
} from './terraform-plan-parser.fixtures';

const terraformFileContent = `
resource "aws_security_group" "allow_ssh" {
    name        = "allow_ssh"
    description = "Allow SSH inbound from anywhere"
    vpc_id      = "123"

    ingress {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
}`;
const terraformPlanFileContent = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../fixtures/iac/terraform-plan/tf-plan-create.json',
  ),
);
const terraformPlanJson = JSON.parse(terraformPlanFileContent.toString());
export const terraformPlanMissingFieldsJson = { ...terraformPlanJson };
export const terraformFileDataStub: IacFileData = {
  fileContent: terraformFileContent,
  filePath: 'dont-care',
  fileType: 'tf',
};
export const terraformPlanDataStub: IacFileData = {
  fileContent: terraformPlanFileContent.toString(),
  filePath: 'dont-care',
  fileType: 'json',
};
export const expectedTerraformParsingResult: IacFileParsed = {
  ...terraformFileDataStub,
  engineType: EngineType.Terraform,
  projectType: IacProjectType.TERRAFORM,
  jsonContent: {
    resource: {
      aws_security_group: {
        allow_ssh: {
          description: 'Allow SSH inbound from anywhere',
          ingress: {
            cidr_blocks: ['0.0.0.0/0'],
            from_port: 22,
            protocol: 'tcp',
            to_port: 22,
          },
          name: 'allow_ssh',
          vpc_id: '123',
        },
      },
    },
  },
};
export const expectedTerraformJsonParsingResult: IacFileParsed = {
  ...terraformPlanDataStub,
  engineType: EngineType.Terraform,
  projectType: IacProjectType.TERRAFORM,
  jsonContent: getExpectedResult(false, PlanOutputCase.Create),
};
const invalidTerraformFileContent = `
resource "aws_security_group" "allow_ssh" {
    name        = "allow_ssh"
    description = "Allow SSH inbound from anywhere"
    vpc_id      = "123"

    ingress INVALID
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
}`;
export const invalidTerraformFileDataStub: IacFileData = {
  fileContent: invalidTerraformFileContent,
  filePath: 'dont-care',
  fileType: 'tf',
};

delete terraformPlanMissingFieldsJson.resource_changes;
