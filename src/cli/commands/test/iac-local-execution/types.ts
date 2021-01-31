import { IacFileInDirectory } from '../../../../lib/types';

// eslint-disable-next-line
export interface IacFileMetadata extends IacFileInDirectory {}
export interface IacFileData extends IacFileMetadata {
  jsonContent: Record<string, any>;
  fileContent: string;
  docId?: number;
}
export interface IacFileScanResult extends IacFileData {
  violatedPolicies: PolicyMetadata[];
}

export interface OpaWasmInstance {
  evaluate: (data: Record<string, any>) => { results: PolicyMetadata[] };
  setData: (data: Record<string, any>) => void;
}

export interface PolicyMetadata {
  id: string;
  publicId: string;
  type: string;
  subType: string;
  title: string;
  description: string;
  severity: string;
  msg: string;
  policyEngineType: 'opa';
  issue: string;
  impact: string;
  resolve: string;
  references: string[];
}
