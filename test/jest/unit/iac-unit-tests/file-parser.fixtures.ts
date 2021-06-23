import * as fs from 'fs';
import * as path from 'path';
import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { MissingRequiredFieldsInKubernetesYamlError } from '../../../../src/cli/commands/test/iac-local-execution/parsers/kubernetes-parser';
import {
  getExpectedResult,
  PlanOutputCase,
} from './terraform-plan-parser.fixtures';

const kubernetesYamlFileContent = `
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
    - name: whatever
      securityContext:
        privileged: true
`;

const kubernetesJson = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name: 'myapp-pod',
  },
  spec: {
    containers: [
      {
        name: 'whatever',
        securityContext: {
          privileged: true,
        },
      },
    ],
  },
};
const kubernetesJsonFileContent = JSON.stringify(kubernetesJson);

const multipleKubernetesYamlsFileContent = `
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
    - name: whatever
      securityContext:
        privileged: true
---
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
    - name: whatever
      securityContext:
        privileged: true
`;

const kubernetesYamlInvalidFileContent = `
apiVersionXYZ: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
    - name: whatever
      securityContext:
        privileged: true
`;

const invalidJsonFile = '{ "foo": "bar"';

const invalidYamlFile = `
foo: "bar
`;

export const kubernetesYamlFileDataStub: IacFileData = {
  fileContent: kubernetesYamlFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const kubernetesJsonFileDataStub: IacFileData = {
  fileContent: kubernetesJsonFileContent,
  filePath: 'dont-care',
  fileType: 'json',
};

export const multipleKubernetesYamlsFileDataStub: IacFileData = {
  fileContent: multipleKubernetesYamlsFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const kubernetesYamlInvalidFileDataStub: IacFileData = {
  fileContent: kubernetesYamlInvalidFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const invalidJsonFileDataStub: IacFileData = {
  fileContent: invalidJsonFile,
  filePath: 'path/to/file',
  fileType: 'json',
};

export const invalidYamlFileDataStub: IacFileData = {
  fileContent: invalidYamlFile,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const expectedKubernetesYamlParsingResult: IacFileParsed = {
  ...kubernetesYamlFileDataStub,
  docId: 0,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};

export const expectedKubernetesJsonParsingResult: IacFileParsed = {
  ...kubernetesJsonFileDataStub,
  docId: 0,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};

export const expectedMultipleKubernetesYamlsParsingResult: IacFileParsed = {
  ...multipleKubernetesYamlsFileDataStub,
  docId: 0,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};

export const expectedKubernetesYamlInvalidParsingResult = {
  err: new MissingRequiredFieldsInKubernetesYamlError(
    'Failed to detect Kubernetes file, missing required fields',
  ),
  failureReason: 'Failed to detect Kubernetes file, missing required fields',
  fileType: 'yml',
  filePath: 'dont-care',
  fileContent: kubernetesYamlInvalidFileDataStub.fileContent,
  engineType: null,
  jsonContent: null,
};

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
const terraformPlanMissingFieldsJson = { ...terraformPlanJson };
delete terraformPlanMissingFieldsJson.resource_changes;
const terraformPlanMissingFieldsFileContent = JSON.stringify(
  terraformPlanMissingFieldsJson,
);

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

export const terraformPlanMissingFieldsDataStub: IacFileData = {
  fileContent: terraformPlanMissingFieldsFileContent.toString(),
  filePath: 'dont-care',
  fileType: 'json',
};

export const expectedTerraformParsingResult: IacFileParsed = {
  ...terraformFileDataStub,
  engineType: EngineType.Terraform,
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
