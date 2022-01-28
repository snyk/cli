import {
  EngineType,
  IacFileData,
  IacFileParsed,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

export const armJsonFileContent = `
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {},
  "resources": [
    {
      "type": "Microsoft.ServiceFabric/clusters",
      "apiVersion": "2021-06-01",
      "name": "denied",
      "properties": {}
    },
    {
      "type": "Microsoft.ServiceFabric/clusters",
      "apiVersion": "2021-06-01",
      "name": "allowed",
      "properties": {
        "azureActiveDirectory": {}
      }
    }
  ]
}`;
export const armJsonFileDataStub: IacFileData = {
  fileContent: armJsonFileContent,
  filePath: 'dont-care',
  fileType: 'json',
};
export const armJsonInvalidFileContent = `
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "parameters": {},
  "resources": [
    {
      "type": "Microsoft.ServiceFabric/clusters",
      "apiVersion": "2021-06-01",
      "name": "denied",
      "properties": {}
    },
    {
      "type": "Microsoft.ServiceFabric/clusters",
      "apiVersion": "2021-06-01",
      "name": "allowed",
      "properties": {
        "azureActiveDirectory": {}
      }
    }
  ]
}`;
export const armJsonInvalidFileDataStub: IacFileData = {
  fileContent: armJsonInvalidFileContent,
  filePath: 'dont-care',
  fileType: 'json',
};
export const expectedArmParsingResult: IacFileParsed = {
  ...armJsonFileDataStub,
  docId: undefined,
  engineType: EngineType.ARM,
  projectType: IacProjectType.ARM,
  jsonContent: {
    $schema:
      'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
    contentVersion: '1.0.0.0',
    parameters: {},
    resources: [
      {
        type: 'Microsoft.ServiceFabric/clusters',
        apiVersion: '2021-06-01',
        name: 'denied',
        properties: {},
      },
      {
        type: 'Microsoft.ServiceFabric/clusters',
        apiVersion: '2021-06-01',
        name: 'allowed',
        properties: {
          azureActiveDirectory: {},
        },
      },
    ],
  },
};
