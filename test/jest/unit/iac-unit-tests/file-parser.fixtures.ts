import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { MissingRequiredFieldsInKubernetesYamlError } from '../../../../src/cli/commands/test/iac-local-execution/parsers/kubernetes-parser';

const kubernetesFileContent = `
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

export const kubernetesFileDataStub: IacFileData = {
  fileContent: kubernetesFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

const kubernetesInvalidFileContent = `
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

export const invalidK8sFileDataStub: IacFileData = {
  fileContent: kubernetesInvalidFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const expectedInvalidK8sFileParsingResult = {
  err: new MissingRequiredFieldsInKubernetesYamlError(
    'Failed to detect Kubernetes file, missing required fields',
  ),
  failureReason: 'Failed to detect Kubernetes file, missing required fields',
  fileType: 'yml',
  filePath: 'dont-care',
  fileContent: invalidK8sFileDataStub.fileContent,
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

export const terraformFileDataStub: IacFileData = {
  fileContent: terraformFileContent,
  filePath: 'dont-care',
  fileType: 'tf',
};

export const expectedKubernetesParsingResult: IacFileParsed = {
  ...kubernetesFileDataStub,
  docId: 0,
  engineType: EngineType.Kubernetes,
  jsonContent: {
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
  },
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
          vpc_id: 123,
        },
      },
    },
  },
};
