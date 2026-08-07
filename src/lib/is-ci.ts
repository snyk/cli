export const ciEnvs = new Set([
  'AZURE_PIPELINES',
  'bamboo.buildKey',
  'BITBUCKET_PIPE_STEP_RUN_UUID',
  'BUILD_ID',
  'BUILD_NUMBER',
  'BUILD_TAG', // Jenkins/Hudson - A string of the format jenkins-${JOB_NAME}-${BUILD_NUMBER}
  'BUILDKITE',
  'BUILDKITE_BUILD_ID', // Buildkite - The unique ID of the build
  'CI',
  'CI_BUILD_ID', // Common CI indicator
  'CI_COMMIT_SHA', // Common CI indicator
  'CI_JOB_ID', // Common CI indicator
  'CI_REPOSITORY_URL', // Common CI indicator
  'CI_SERVER_NAME', // Common CI indicator
  'CIRCLE_WORKFLOW_ID', // CircleCI - A unique ID for the entire workflow
  'CIRCLECI',
  'CODEBUILD', // AWS CodeBuild
  'CONTINUOUS_INTEGRATION',
  'DRONE',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'GOCD_SERVER_HOST',
  'HUDSON_URL',
  'JENKINS_URL',
  'NETLIFY',
  'NOW_BUILD', // Vercel (Legacy)
  'PHPCI',
  'SEMAPHORE',
  'SNYK_CI',
  'SYSTEM_TEAMFOUNDATIONSERVERURI', // for Azure DevOps Pipelines
  'SYSTEM_TEAMPROJECTID', // Azure DevOps Pipelines - ID of the ADO project
  'TEAMCITY_VERSION',
  'TF_BUILD',
  'TRAVIS',
  'TRAVIS_PULL_REQUEST', // Travis CI - The PR # (false if not a PR build)
  'VERCEL',
]);

export function isCI(): boolean {
  return Object.keys(process.env).some((key) => ciEnvs.has(key));
}
