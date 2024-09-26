import { SEVERITY } from '../../../snyk-test/legacy';

export interface TestConfig {
  paths: string[];
  iacCachePath: string;
  userRulesBundlePath?: string;
  userPolicyEnginePath?: string;
  userRulesClientURL?: string;
  report: boolean;
  severityThreshold?: SEVERITY;
  targetReference?: string;
  targetName?: string;
  remoteRepoUrl?: string;
  policy?: string;
  scan: string;
  varFile?: string;
  depthDetection?: number;
  snykCloudEnvironment?: string;
  insecure?: boolean;
  org?: string;
  customRules?: boolean;
  experimental?: boolean;
  iacNewEngine?: boolean;
}
