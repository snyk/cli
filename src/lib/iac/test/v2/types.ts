import { IacOrgSettings } from '../../../../cli/commands/test/iac/local-execution/types';
import { SEVERITY } from '../../../snyk-test/legacy';
import { ProjectAttributes, Tag } from '../../../types';

export interface TestConfig {
  paths: string[];
  iacCachePath: string;
  userRulesBundlePath?: string;
  userPolicyEnginePath?: string;
  orgSettings: IacOrgSettings;
  report: boolean;
  severityThreshold?: SEVERITY;
  attributes?: ProjectAttributes;
  projectTags?: Tag[];
  targetReference?: string;
  targetName?: string;
  remoteRepoUrl?: string;
  policy?: string;
  scan: string;
}
