import { isLocalFolder } from '../../../../lib/detect';
import {
  EngineType,
  IaCErrorCodes,
  IacFileParsed,
  IacFileParseFailure,
  IaCTestFlags,
  layerContentType,
  manifestContentType,
  SafeAnalyticsOutput,
  TestReturnValue,
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
import { FlagError } from './assert-iac-options-flag';
import { config as userConfig } from '../../../../lib/user-config';
import config from '../../../../lib/config';
import { findAndLoadPolicy } from '../../../../lib/policy';
import { CustomError } from '../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import {
  extractURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidManifestSchemaVersionError,
  InvalidRemoteRegistryURLError,
} from './oci-pull';

// this method executes the local processing engine and then formats the results to adapt with the CLI output.
// this flow is the default GA flow for IAC scanning.
export async function test(
  pathToScan: string,
  options: IaCTestFlags,
): Promise<TestReturnValue> {
  try {
    const org = options.org ?? config.org;
    const iacOrgSettings = await getIacOrgSettings(org);
    const customRulesPath = await customRulesPathForOrg(options.rules, org);

    const OCIRegistryURL =
      (iacOrgSettings.customRules?.isEnabled &&
        iacOrgSettings.customRules?.ociRegistryURL) ||
      userConfig.get('oci-registry-url');

    if (OCIRegistryURL && customRulesPath) {
      throw new FailedToExecuteCustomRulesError();
    }

    if (OCIRegistryURL) {
      if (!isValidURL(OCIRegistryURL)) {
        throw new InvalidRemoteRegistryURLError();
      }

      const URLComponents = extractURLComponents(OCIRegistryURL);
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
        await pull(URLComponents, opt);
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
    if (customRulesPath || OCIRegistryURL) {
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

async function customRulesPathForOrg(
  customRulesPath: string | undefined,
  publicOrgId: string,
): Promise<string | undefined> {
  if (!customRulesPath) return;

  const isCustomRulesSupported = (
    await isFeatureFlagSupportedForOrg('iacCustomRules', publicOrgId)
  ).ok;
  if (isCustomRulesSupported) {
    return customRulesPath;
  }

  throw new FlagError('rules', 'iacCustomRules');
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

export function isValidURL(string) {
  let url;
  try {
    url = new URL(string);
  } catch (e) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
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
