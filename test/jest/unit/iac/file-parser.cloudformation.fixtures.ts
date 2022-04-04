import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac/local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

const cloudFormationYAMLFileContent = `
Description:  Aurora

# Create the Aurora MySQL DB

Parameters:

  NetworkStackName:
    Description: Name of an active CloudFormation stack that contains networking resources
    Type: String
    MinLength: 1
    MaxLength: 255
    AllowedPattern: "^[a-zA-Z][-a-zA-Z0-9]*$"

Resources:

  DatabaseAlarmTopic:
    Type: AWS::SNS::Topic
    Condition: AlarmsEnabled
    Properties:
      DisplayName: Database Alarm Topic
`;

const cloudFormationJSON = {
  Description: 'Aurora',
  Parameters: {
    NetworkStackName: {
      Description:
        'Name of an active CloudFormation stack that contains networking resources',
      Type: 'String',
      MinLength: 1,
      MaxLength: 255,
      AllowedPattern: '^[a-zA-Z][-a-zA-Z0-9]*$',
    },
  },
  Resources: {
    DatabaseAlarmTopic: {
      Type: 'AWS::SNS::Topic',
      Condition: 'AlarmsEnabled',
      Properties: {
        DisplayName: 'Database Alarm Topic',
      },
    },
  },
};

export const cloudFormationJSONFileContent = JSON.stringify(cloudFormationJSON);

export const cloudFormationYAMLFileDataStub: IacFileData = {
  fileContent: cloudFormationYAMLFileContent,
  filePath: 'dont-care',
  fileType: 'yml',
};

export const cloudFormationJSONFileDataStub: IacFileData = {
  fileContent: cloudFormationJSONFileContent,
  filePath: 'dont-care',
  fileType: 'json',
};

export const expectedCloudFormationYAMLParsingResult: IacFileParsed = {
  ...cloudFormationYAMLFileDataStub,
  docId: 0,
  projectType: IacProjectType.CLOUDFORMATION,
  engineType: EngineType.CloudFormation,
  jsonContent: cloudFormationJSON,
};

export const expectedCloudFormationJSONParsingResult: IacFileParsed = {
  ...cloudFormationJSONFileDataStub,
  docId: undefined,
  projectType: IacProjectType.CLOUDFORMATION,
  engineType: EngineType.CloudFormation,
  jsonContent: cloudFormationJSON,
};
