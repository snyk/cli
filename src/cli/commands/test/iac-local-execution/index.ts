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
import { isFeatureFlagSupportedForOrg } from '../../../../lib/feature-flags';
import {
  UnsupportedEntitlementFlagError,
  FlagError,
} from './assert-iac-options-flag';
import { config as userConfig } from '../../../../lib/user-config';
import config from '../../../../lib/config';
import { findAndLoadPolicy } from '../../../../lib/policy';
import {
  CustomError,
  UnsupportedFeatureFlagError,
} from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import {
  extractOCIRegistryURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidManifestSchemaVersionError,
  InvalidRemoteRegistryURLError,
  UnsupportedEntitlementPullError,
  UnsupportedFeatureFlagPullError,
} from './oci-pull';
import { UnsupportedEntitlementError } from '../../../../lib/errors/unsupported-entitlement-error';

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
      await assertRulesFlagAvailable(orgPublicId, iacOrgSettings);
      customRulesPath = options.rules;
    }

    const isOCIRegistryURLProvided = checkOCIRegistryURLProvided(
      iacOrgSettings,
    );

    if (isOCIRegistryURLProvided && customRulesPath) {
      throw new FailedToExecuteCustomRulesError();
    }

    if (isOCIRegistryURLProvided) {
      await assertPullAvailable(orgPublicId, iacOrgSettings);
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

    addIacAnalytics(filteredIssues, ignoreCount, !!customRulesPath);

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

export function isValidURL(str: string): boolean {
  let url;
  try {
    url = new URL(str);
  } catch (e) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
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

  if (!isValidURL(settingsOCIRegistryURL)) {
    throw new InvalidRemoteRegistryURLError();
  }

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

  if (!isValidURL(envOCIRegistryURL)) {
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
        'The remote repository could not be found. Please check the provided URL.',
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

/**
 * Asserts the custom-rules feature is available for the provided org.
 */
async function assertCustomRulesAvailable(
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
): Promise<void> {
  const isCustomRulesEnabled = !!(
    await isFeatureFlagSupportedForOrg('iacCustomRules', orgPublicId)
  ).ok;

  if (!isCustomRulesEnabled) {
    throw new UnsupportedFeatureFlagError('iacCustomRules');
  }

  const isEntitledToCustomRules = !!iacOrgSettings.entitlements
    ?.iacCustomRulesEntitlement;

  if (!isEntitledToCustomRules) {
    throw new UnsupportedEntitlementError('iacCustomRulesEntitlement');
  }
}

/**
 * Asserts the --rules flag is available for the provided org.
 */
async function assertRulesFlagAvailable(
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
) {
  try {
    await assertCustomRulesAvailable(orgPublicId, iacOrgSettings);
  } catch (err) {
    if (err instanceof UnsupportedEntitlementError) {
      throw new UnsupportedEntitlementFlagError('rules', err.entitlement);
    } else if (err instanceof UnsupportedFeatureFlagError) {
      throw new FlagError('rules', err.featureFlag);
    } else {
      throw err;
    }
  }
}

/**
 * Asserts the feature custom-rules bundles pulling feature is available for the provided org.
 */
async function assertPullAvailable(
  orgPublicId: string,
  iacOrgSettings: IacOrgSettings,
) {
  try {
    await assertCustomRulesAvailable(orgPublicId, iacOrgSettings);
  } catch (err) {
    if (err instanceof UnsupportedEntitlementError) {
      throw new UnsupportedEntitlementPullError(err.entitlement);
    } else if (err instanceof UnsupportedFeatureFlagError) {
      throw new UnsupportedFeatureFlagPullError(err.featureFlag);
    }
  }
}

export class FailedToPullCustomBundleError extends CustomError {
  constructor(message?: string) {
    super(message || 'Could not pull custom bundle');
    this.code = IaCErrorCodes.FailedToPullCustomBundleError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = `${message ? message + ' ' : ''}
    We were unable to download the custom bundle to the disk. Please ensure access to the remote Registry and validate you have provided all the right parameters.`;
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
