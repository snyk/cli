export type IacProjectTypes =
  | 'k8sconfig'
  | 'terraformconfig'
  | 'multiiacconfig';
export type IacFileTypes = 'yaml' | 'yml' | 'json' | 'tf';

export type CODE = 'code';

export type CodeValidateResponse = {
  body?: {
    isValidTerraformFile: boolean;
    reason: string;
  };
};

export interface CodeValidationResponse {
  isValidFile: boolean;
  reason: string;
}
