import { isLocalFolder } from '../../../../lib/detect';
import {
  EngineType,
  IaCErrorCodes,
  IacFileParsed,
  IacFileParseFailure,
  IaCTestFlags,
  layerContentType,
  manifestContentType,
  OCIRegistryURLComponents,
  SafeAnalyticsOutput,
  TestReturnValue,
  IacOrgSettings,
} from './types';
import { addIacAnalytics } from './analytics';
import { TestLimitReachedError } from './usage-tracking';
import { filterIgnoredIssues } from './policy';
import { TestResult } from '../../../../lib/snyk-test/legacy';
import {
  applyCustomSeverities,
  cleanLocalCache,
  formatScanResults,
  getIacOrgSettings,
  initLocalCache,
  loadFiles,
  parseFiles,
  pull,
  scanFiles,
  trackUsage,
} from './measurable-methods';
import {
  FlagError,
  UnsupportedEntitlementFlagError,
} from './assert-iac-options-flag';
import { config as userConfig } from '../../../../lib/user-config';
import config from '../../../../lib/config';
import { findAndLoadPolicy } from '../../../../lib/policy';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import {
  extractOCIRegistryURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidManifestSchemaVersionError,
  InvalidRemoteRegistryURLError,
  UnsupportedEntitlementPullError,
} from './oci-pull';
import { isValidUrl } from './url-utils';
import chalk from 'chalk';
import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import { sendReport } from '../../../../lib/iac/cli-report';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  try {
    let customRulesPath: string | undefined;

    const orgPublicId = options.org ?? config.org;

    const iacOrgSettings = await getIacOrgSettings(orgPublicId);

    if (options.rules) {
      if (!iacOrgSettings.entitlements?.iacCustomRulesEntitlement) {
        throw new UnsupportedEntitlementFlagError(
          'rules',
          'iacCustomRulesEntitlement',
        );
      }
      customRulesPath = options.rules;
    }

    const isOCIRegistryURLProvided = checkOCIRegistryURLProvided(
      iacOrgSettings,
    );

    if (
      (isOCIRegistryURLProvided || customRulesPath) &&
      !(options.sarif || options.json)
    ) {
      console.log(
        chalk.hex('#ff9b00')(
          'Using custom rules to generate misconfigurations.',
        ),
      );
    }

    if (isOCIRegistryURLProvided && customRulesPath) {
      throw new FailedToExecuteCustomRulesError();
    }

    if (isOCIRegistryURLProvided) {
      if (!iacOrgSettings.entitlements?.iacCustomRulesEntitlement) {
        throw new UnsupportedEntitlementPullError('iacCustomRulesEntitlement');
      }
      await pullIaCCustomRules(iacOrgSettings);
    } else {
      await initLocalCache({ customRulesPath });
    }

    const policy = await findAndLoadPolicy(pathToScan, 'iac', options);

    const filesToParse = await loadFiles(pathToScan, options);
    const { parsedFiles, failedFiles } = await parseFiles(
      filesToParse,
      options,
    );

    // Duplicate all the files and run them through the custom engine.
    if (customRulesPath || isOCIRegistryURLProvided) {
      parsedFiles.push(
        ...parsedFiles.map((file) => ({
          ...file,
          engineType: EngineType.Custom,
        })),
      );
    }

    const scannedFiles = await scanFiles(parsedFiles);
    const resultsWithCustomSeverities = await applyCustomSeverities(
      scannedFiles,
      iacOrgSettings.customPolicies,
    );
    const formattedResults = formatScanResults(
      resultsWithCustomSeverities,
      options,
      iacOrgSettings.meta,
    );

    const { filteredIssues, ignoreCount } = filterIgnoredIssues(
      policy,
      formattedResults,
    );

    try {
      await trackUsage(filteredIssues);
    } catch (e) {
      if (e instanceof TestLimitReachedError) {
        throw e;
      }
      // If something has gone wrong, err on the side of allowing the user to
      // run their tests by squashing the error.
    }

    if (options.report) {
      const isCliReportEnabled = await isFeatureFlagSupportedForOrg(
        'iacCliReport',
        orgPublicId,
      );

      if (!isCliReportEnabled.ok) {
        throw new FlagError('report', 'iacCliReport');
      }

      sendReport(filteredIssues);
    }

    addIacAnalytics(filteredIssues, ignoreCount);

    // TODO: add support for proper typing of old TestResult interface.
    return {
      results: (filteredIssues as unknown) as TestResult[],
      // NOTE: No file or parsed file data should leave this function.
      failures: isLocalFolder(pathToScan)
        ? failedFiles.map(removeFileContent)
        : undefined,
    };
  } finally {
    cleanLocalCache();
  }
}

export function removeFileContent({
  filePath,
  fileType,
  failureReason,
  projectType,
}: IacFileParsed | IacFileParseFailure): SafeAnalyticsOutput {
  return {
    filePath,
    fileType,
    failureReason,
    projectType,
  };
}

/**
 * Checks if the OCI registry URL has been provided.
 */
function checkOCIRegistryURLProvided(iacOrgSettings: IacOrgSettings): boolean {
  return (
    checkOCIRegistryURLExistsInSettings(iacOrgSettings) ||
    !!userConfig.get('oci-registry-url')
  );
}

/**
 * Checks if the OCI registry URL was provided in the org's IaC settings.
 */
function checkOCIRegistryURLExistsInSettings(
  iacOrgSettings: IacOrgSettings,
): boolean {
  return (
    !!iacOrgSettings.customRules?.isEnabled &&
    !!iacOrgSettings.customRules?.ociRegistryURL
  );
}

/**
 * Extracts the OCI registry URL components from the org's IaC settings.
 */
function getOCIRegistryURLComponentsFromSettings(
  iacOrgSettings: IacOrgSettings,
) {
  const settingsOCIRegistryURL = iacOrgSettings.customRules!.ociRegistryURL!;

  return {
    ...extractOCIRegistryURLComponents(settingsOCIRegistryURL),
    tag: iacOrgSettings.customRules!.ociRegistryTag || 'latest',
  };
}

/**
 * Extracts the OCI registry URL components from the environment variables.
 */
function getOCIRegistryURLComponentsFromEnv() {
  const envOCIRegistryURL = userConfig.get('oci-registry-url')!;

  if (!isValidUrl(envOCIRegistryURL)) {
    throw new InvalidRemoteRegistryURLError();
  }

  return extractOCIRegistryURLComponents(envOCIRegistryURL);
}

/**
 * Gets the OCI registry URL components from either the env variables or the IaC org settings.
 */
function getOCIRegistryURLComponents(
  iacOrgSettings: IacOrgSettings,
): OCIRegistryURLComponents {
  if (checkOCIRegistryURLExistsInSettings(iacOrgSettings)) {
    return getOCIRegistryURLComponentsFromSettings(iacOrgSettings);
  }

  // Default is to get the URL from env variables.
  return getOCIRegistryURLComponentsFromEnv();
}

/**
 * Pull and store the IaC custom-rules bundle from the remote OCI Registry.
 */
export async function pullIaCCustomRules(
  iacOrgSettings: IacOrgSettings,
): Promise<void> {
  const ociRegistryURLComponents = getOCIRegistryURLComponents(iacOrgSettings);

  const username = userConfig.get('oci-registry-username');
  const password = userConfig.get('oci-registry-password');

  const opt = {
    username,
    password,
    reqOptions: {
      acceptManifest: manifestContentType,
      acceptLayer: layerContentType,
      indexContentType: '',
    },
  };

  try {
    await pull(ociRegistryURLComponents, opt);
  } catch (err) {
    if (err.statusCode === 401) {
      throw new FailedToPullCustomBundleError(
        'There was an authentication error. Incorrect credentials provided.',
      );
    } else if (err.statusCode === 404) {
      throw new FailedToPullCustomBundleError(
        'The remote repository could not be found. Please check the provided registry URL.',
      );
    } else if (err instanceof InvalidManifestSchemaVersionError) {
      throw new FailedToPullCustomBundleError(err.message);
    } else if (err instanceof FailedToBuildOCIArtifactError) {
      throw new FailedToBuildOCIArtifactError();
    } else if (err instanceof InvalidRemoteRegistryURLError) {
      throw new InvalidRemoteRegistryURLError();
    } else {
      throw new FailedToPullCustomBundleError();
    }
  }
}

export class FailedToPullCustomBundleError extends CustomError {
  constructor(message?: string) {
    super(message || 'Could not pull custom bundle');
    this.code = IaCErrorCodes.FailedToPullCustomBundleError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage =
      `${message ? message + ' ' : ''}` +
      '\nWe were unable to download the custom bundle to the disk. Please ensure access to the remote Registry and validate you have provided all the right parameters.' +
      '\nSee documentation on troubleshooting: https://docs.snyk.io/products/snyk-infrastructure-as-code/custom-rules/use-IaC-custom-rules-with-CLI/using-a-remote-custom-rules-bundle#troubleshooting';
  }
}

export class FailedToExecuteCustomRulesError extends CustomError {
  constructor(message?: string) {
    super(message || 'Could not execute custom rules mode');
    this.code = IaCErrorCodes.FailedToExecuteCustomRulesError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `
    Remote and local custom rules bundle can not be used at the same time.
    Please provide a registry URL for the remote bundle, or specify local path location by using the --rules flag for the local bundle.`;
  }
}
