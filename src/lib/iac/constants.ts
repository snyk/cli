import { ParserFileType } from '@snyk/cloud-config-parser';

export type IacProjectTypes =
  | 'iac'
  | 'k8sconfig'
  | 'terraformconfig'
  | 'cloudformationconfig'
  | 'armconfig'
  | 'customconfig'
  | 'multiiacconfig';
export type IacFileTypes = ParserFileType | 'tf' | 'tfvars';

export enum IacProjectType {
  IAC = 'iac',
  K8S = 'k8sconfig',
  TERRAFORM = 'terraformconfig',
  CLOUDFORMATION = 'cloudformationconfig',
  ARM = 'armconfig',
  CUSTOM = 'customconfig',
  MULTI_IAC = 'multiiacconfig',
}

export const TEST_SUPPORTED_IAC_PROJECTS: IacProjectTypes[] = [
  IacProjectType.IAC,
  IacProjectType.K8S,
  IacProjectType.TERRAFORM,
  IacProjectType.CLOUDFORMATION,
  IacProjectType.ARM,
  IacProjectType.MULTI_IAC,
  IacProjectType.CUSTOM,
];

export const iacRemediationTypes: { [k in IacProjectTypes]?: string } = {
  armconfig: 'arm',
  cloudformationconfig: 'cloudformation',
  k8sconfig: 'kubernetes',
  terraformconfig: 'terraform',
};

export const IacV2Name = 'IaC+';

export const IacV2ShortLink = 'https://snyk.co/iac+';
