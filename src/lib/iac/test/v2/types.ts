import { IacOrgSettings } from '../../../../cli/commands/test/iac/local-execution/types';

export interface TestConfig {
  paths: string[];
  iacCachePath: string;
  userRulesBundlePath?: string;
  userPolicyEnginePath?: string;
  projectName: string;
  orgSettings: IacOrgSettings;
}
