const ciEnvs = new Set([
  'SNYK_CI',
  'CI',
  'CONTINUOUS_INTEGRATION',
  'BUILD_ID',
  'BUILD_NUMBER',
  'TEAMCITY_VERSION',
  'TRAVIS',
  'CIRCLECI',
  'JENKINS_URL',
  'HUDSON_URL',
  'bamboo.buildKey',
  'PHPCI',
  'GOCD_SERVER_HOST',
  'BUILDKITE',
  'TF_BUILD',
  'SYSTEM_TEAMFOUNDATIONSERVERURI', // for Azure DevOps Pipelines
]);

export function isCI(): boolean {
  return Object.keys(process.env).some((key) => ciEnvs.has(key));
}
