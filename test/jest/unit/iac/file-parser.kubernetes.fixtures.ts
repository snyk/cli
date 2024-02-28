import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac/local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

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
# Empty doc
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
---
# An ignored, unrecognised config type
foo: bar
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

const unrecognisedYamlFile = `
foo: bar
`;

const semanticYamlWithDuplicateKeyFile = `
apiVersion: v1
kind: Pod
metadata:
  name: myapp-pod
spec:
  containers:
  something: here
metadata:
  another: thing
`;

const semanticYamlErrorFileJSON = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    another: 'thing', //in a case of a duplicate key, the last one will be the one used when parsed
  },
  spec: {
    containers: null,
    something: 'here',
  },
};

const yamlWithInsufficientIndentationFile = `
Resources:
 Denied:
   Type: "AWS::IAM::Role"
   Properties:
     AssumeRolePolicyDocument: {
 "Version": "2012-10-17",
 "Statement": [
   {
     "Action": "sts:AssumeRole",
     "Principal": {
       "AWS": "arn:aws:iam::123456789012:root"
     },
     "Effect": "Allow",
     "Sid": ""
   }
 ]
}
`;

const yamlWithInsufficientIndentationFileJSON = {
  Resources: {
    Denied: {
      Type: 'AWS::IAM::Role',
      Properties: {
        AssumeRolePolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Principal: {
                AWS: 'arn:aws:iam::123456789012:root',
              },
              Effect: 'Allow',
              Sid: '',
            },
          ],
        },
      },
    },
  },
};

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

export const unrecognisedYamlDataStub: IacFileData = {
  fileContent: unrecognisedYamlFile,
  filePath: 'file.yml',
  fileType: 'yml',
};

export const duplicateKeyYamlErrorFileDataStub: IacFileData = {
  fileContent: semanticYamlWithDuplicateKeyFile,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const expectedDuplicateKeyYamlErrorFileParsingResult: IacFileParsed = {
  ...duplicateKeyYamlErrorFileDataStub,
  docId: 0,
  projectType: IacProjectType.K8S,
  engineType: EngineType.Kubernetes,
  jsonContent: semanticYamlErrorFileJSON,
};

export const insufficientIndentationYamlErrorFileDataStub: IacFileData = {
  fileContent: yamlWithInsufficientIndentationFile,
  filePath: 'dont-care',
  fileType: 'yml',
};
export const expectedInsufficientIndentationYamlErrorFileParsingResult: IacFileParsed = {
  ...insufficientIndentationYamlErrorFileDataStub,
  docId: 0,
  projectType: IacProjectType.CLOUDFORMATION,
  engineType: EngineType.CloudFormation,
  jsonContent: yamlWithInsufficientIndentationFileJSON,
};

export const expectedKubernetesYamlParsingResult: IacFileParsed = {
  ...kubernetesYamlFileDataStub,
  docId: 0,
  projectType: IacProjectType.K8S,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};

export const expectedKubernetesJsonParsingResult: IacFileParsed = {
  ...kubernetesJsonFileDataStub,
  docId: undefined,
  projectType: IacProjectType.K8S,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};

export const expectedMultipleKubernetesYamlsParsingResult: IacFileParsed = {
  ...multipleKubernetesYamlsFileDataStub,
  docId: 0,
  projectType: IacProjectType.K8S,
  engineType: EngineType.Kubernetes,
  jsonContent: kubernetesJson,
};
