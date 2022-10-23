/*
  We are collecting Snyk CLI usage in our official integrations

  We distinguish them by either:
  - Setting SNYK_INTEGRATION_NAME or SNYK_INTEGRATION_VERSION in environment when CLI is run
  - passing an --integration-name or --integration-version flags on CLI invocation

  Integration name is validated with a list
*/

import { exec } from 'child_process';
import * as createDebug from 'debug';
import * as fs from 'fs';
import { join } from 'path';
import { ArgsOptions } from '../../cli/args';

const debug = createDebug('snyk');

export const INTEGRATION_NAME_ENVVAR = 'SNYK_INTEGRATION_NAME';
export const INTEGRATION_VERSION_ENVVAR = 'SNYK_INTEGRATION_VERSION';
export const INTEGRATION_ENVIRONMENT_ENVVAR = 'SNYK_INTEGRATION_ENVIRONMENT';
export const INTEGRATION_ENVIRONMENT_VERSION_ENVVAR =
  'SNYK_INTEGRATION_ENVIRONMENT_VERSION';

enum TrackedIntegration {
  // tracked by passing envvar on CLI invocation
  HOMEBREW = 'HOMEBREW',
  SCOOP = 'SCOOP',

  // Our Docker images - tracked by passing envvar on CLI invocation
  DOCKER_SNYK_CLI = 'DOCKER_SNYK_CLI', // docker snyk/snyk-cli
  DOCKER_SNYK = 'DOCKER_SNYK', // docker snyk/snyk

  // IDE plugins - tracked by passing flag or envvar on CLI invocation
  JETBRAINS_IDE = 'JETBRAINS_IDE',
  ECLIPSE = 'ECLIPSE',
  VISUAL_STUDIO = 'VISUAL_STUDIO',
  VS_CODE = 'VS_CODE',
  VS_CODE_VULN_COST = 'VS_CODE_VULN_COST',

  // CI - tracked by passing flag or envvar on CLI invocation
  JENKINS = 'JENKINS',
  TEAMCITY = 'TEAMCITY',
  BITBUCKET_PIPELINES = 'BITBUCKET_PIPELINES',
  AZURE_PIPELINES = 'AZURE_PIPELINES',
  CIRCLECI_ORB = 'CIRCLECI_ORB',
  GITHUB_ACTIONS = 'GITHUB_ACTIONS',
  MAVEN_PLUGIN = 'MAVEN_PLUGIN',
  AWS_CODEPIPELINE = 'AWS_CODEPIPELINE',

  // Partner integrations - tracked by passing envvar on CLI invocation
  DOCKER_DESKTOP = 'DOCKER_DESKTOP',

  // DevRel integrations and plugins
  // Netlify plugin: https://github.com/snyk-labs/netlify-plugin-snyk
  NETLIFY_PLUGIN = 'NETLIFY_PLUGIN',

  // CLI_V1_PLUGIN integration
  CLI_V1_PLUGIN = 'CLI_V1_PLUGIN',
}

export const getIntegrationName = (args: ArgsOptions[]): string => {
  const maybeHomebrew = isHomebrew() ? 'HOMEBREW' : '';
  const maybeScoop = isScoop() ? 'SCOOP' : '';

  const integrationName = (
    (args[0]?.integrationName as string) || // Integration details passed through CLI flag
    process.env[INTEGRATION_NAME_ENVVAR] ||
    maybeHomebrew ||
    maybeScoop ||
    ''
  ).toUpperCase();
  if (integrationName in TrackedIntegration) {
    return integrationName;
  }

  return '';
};

export const getIntegrationVersion = (args: ArgsOptions[]): string =>
  (args[0]?.integrationVersion as string) ||
  process.env[INTEGRATION_VERSION_ENVVAR] ||
  '';

export const getIntegrationEnvironment = (args: ArgsOptions[]): string =>
  (args[0]?.integrationEnvironment as string) ||
  process.env[INTEGRATION_ENVIRONMENT_ENVVAR] ||
  '';

export const getIntegrationEnvironmentVersion = (args: ArgsOptions[]): string =>
  (args[0]?.integrationEnvironmentVersion as string) ||
  process.env[INTEGRATION_ENVIRONMENT_VERSION_ENVVAR] ||
  '';

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
    const snykScoopManifestPath = snykExecutablePath.replace(
      'snyk-win.exe',
      'manifest.json',
    );
    if (fs.existsSync(snykScoopManifestPath)) {
      const manifestJson = JSON.parse(
        fs.readFileSync(snykScoopManifestPath, 'utf8'),
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

export function isHomebrew(): boolean {
  const currentProcessPath = process.execPath;
  const isHomebrewPath = currentProcessPath.includes('/Cellar/snyk/');
  if (isHomebrewPath) {
    return validateHomebrew(currentProcessPath);
  } else {
    return false;
  }
}

export function validateHomebrew(snykExecutablePath: string): boolean {
  try {
    const expectedFormulaFilePath = join(
      snykExecutablePath,
      '../../.brew/snyk.rb',
    );
    const formulaFileExists = fs.existsSync(expectedFormulaFilePath);
    return formulaFileExists;
  } catch (error) {
    debug('Error checking for Homebrew Formula file', error);
  }
  return false;
}

function runCommand(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        debug("Error trying to get program's version", error);
      }
      return resolve(stdout ? stdout : stderr);
    });
  });
}

export async function isInstalled(commandToCheck: string): Promise<boolean> {
  let whichCommand = 'which';
  const os = process.platform;
  if (os === 'win32') {
    whichCommand = 'where';
  } else if (os === 'android') {
    whichCommand = 'adb shell which';
  }

  try {
    await runCommand(`${whichCommand} ${commandToCheck}`);
  } catch (error) {
    return false;
  }
  return true;
}
