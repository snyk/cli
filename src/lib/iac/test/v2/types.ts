export interface TestConfig {
  iacCachePath: string;
  options: TestOptions;
}

export interface TestOptions {
  userRulesBundlePath?: string;
  userPolicyEnginePath?: string;
}
