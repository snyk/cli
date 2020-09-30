/*
  We are collecting Snyk CLI usage in our official integrations

  We distinguish them by either:
  - Setting SNYK_INTEGRATION_NAME or SNYK_INTEGRATION_VERSION in environment when CLI is run
  - passing an --integration-name or --integration-version flags on CLI invocation

  Integration name is validated with a list
*/

const debug = require('debug')('snyk');
import * as fs from 'fs';
import { ArgsOptions } from '../cli/args';

export const INTEGRATION_NAME_HEADER = 'SNYK_INTEGRATION_NAME';
export const INTEGRATION_VERSION_HEADER = 'SNYK_INTEGRATION_VERSION';

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

export const getIntegrationName = (args: ArgsOptions[]): string => {
  const maybeScoop = isScoop() ? 'SCOOP' : '';
  const integrationName = String(
    args[0]?.integrationName || // Integration details passed through CLI flag
      process.env[INTEGRATION_NAME_HEADER] ||
      maybeScoop ||
      '',
  ).toUpperCase();
  if (integrationName in TrackedIntegration) {
    return integrationName;
  }

  return '';
};

export const getIntegrationVersion = (args: ArgsOptions[]): string => {
  // Integration details passed through CLI flag
  const integrationVersion = String(
    args[0]?.integrationVersion ||
      process.env[INTEGRATION_VERSION_HEADER] ||
      '',
  );

  return integrationVersion;
};

export function isScoop(): boolean {
  const currentProcessPath = process.execPath;
  const looksLikeScoop =
    currentProcessPath.includes('snyk-win.exe') &&
    currentProcessPath.includes('scoop');

  if (looksLikeScoop) {
    return validateScoopManifestFile(currentProcessPath);
  } else {
    return false;
  }
}

export function validateScoopManifestFile(snykExecutablePath: string): boolean {
  // If this really is installed with scoop, there should be a `manifest.json` file adjacent to the running CLI executable (`snyk-win.exe`) which
  // we can look at for further validation that this really is from scoop.
  try {
    const snykScoopManifiestPath = snykExecutablePath.replace(
      'snyk-win.exe',
      'manifest.json',
    );
    if (fs.existsSync(snykScoopManifiestPath)) {
      const manifestJson = JSON.parse(
        fs.readFileSync(snykScoopManifiestPath, 'utf8'),
      );

      const url = manifestJson.url;
      if (
        url.startsWith('https://github.com/snyk/snyk') &&
        url.endsWith('snyk-win.exe')
      ) {
        return true;
      }
    }
  } catch (error) {
    debug('Error validating scoop manifest file', error);
  }
  return false;
}
