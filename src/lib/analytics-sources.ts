/*
  We are collecting Snyk CLI usage in our official integrations

  We distinguish them by either:
  - Setting SNYK_INTEGRATION_NAME or SNYK_INTEGRATION_VERSION in environment when CLI is run
  - passing an --integration-name or --integration-version flags on CLI invocation

  Integration name is validated with a list
*/

export const integrationNameHeader = 'SNYK_INTEGRATION_NAME';
export const integrationVersionHeader = 'SNYK_INTEGRATION_VERSION';

enum TrackedIntegration {
  // Distribution builds/packages
  NPM = 'NPM', // registry - how can we detect this one? Not standalone?
  STANDALONE = 'STANDALONE', // Tracked by detecting "isStandalone" flag

  // tracked by passing envvar on CLI invocation
  HOMEBREW = 'HOMEBREW',
  SCOOP = 'SCOOP',

  // Our Docker images - tracked by passing envvar on CLI invocation
  DOCKER_SNYK_CLI = 'DOCKER_SNYK_CLI', // docker snyk/snyk-cli
  DOCKER_SNYK = 'DOCKER_SNYK', // docker snyk/snyk

  // IDE plugins - tracked by passing flag or envvar on CLI invocation
  JETBRAINS_IDE = 'JETBRAINS_IDE',
  ECLIPSE = 'ECLIPSE',
  VS_CODE_VULN_COST = 'VS_CODE_VULN_COST',

  // CI - tracked by passing flag or envvar on CLI invocation
  JENKINS = 'JENKINS',
  TEAMCITY = 'TEAMCITY',
  BITBUCKET_PIPELINES = 'BITBUCKET_PIPELINES',
  AZURE_PIPELINES = 'AZURE_PIPELINES',
  CIRCLECI_ORB = 'CIRCLECI_ORB',
  GITHUB_ACTIONS = 'GITHUB_ACTIONS',

  // Partner integrations - tracked by passing envvar on CLI invocation
  DOCKER_DESKTOP = 'DOCKER_DESKTOP',

  // DevRel integrations and plugins
  // Netlify plugin: https://github.com/snyk-labs/netlify-plugin-snyk
  NETLIFY_PLUGIN = 'NETLIFY_PLUGIN',
}

// TODO: propagate these to the UTM params
export const getIntegrationName = (args: Array<any>): string => {
  const integrationName = String(
    args[0]?.integrationName || // Integration details passed through CLI flag
      process.env[integrationNameHeader] ||
      '',
  ).toUpperCase();
  if (integrationName in TrackedIntegration) {
    return integrationName;
  }

  return '';
};

export const getIntegrationVersion = (args): string => {
  // Integration details passed through CLI flag
  const integrationVersion = String(
    args[0]?.integrationVersion || process.env[integrationVersionHeader] || '',
  );

  return integrationVersion;
};
