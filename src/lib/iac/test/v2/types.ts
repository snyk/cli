export interface TestConfig {
  paths: string[];
  cachedBundlePath: string;
  cachedPolicyEnginePath: string;
  userBundlePath?: string;
  userPolicyEnginePath?: string;
}
