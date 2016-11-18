var ciEnvs = [
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
];

module.exports = !!Object.keys(process.env).filter(function (env) {
  return ciEnvs.indexOf(env) !== -1;
}).length;
