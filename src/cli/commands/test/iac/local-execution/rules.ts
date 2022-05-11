import {
  IaCErrorCodes,
  IacOrgSettings,
  IaCTestFlags,
  layerContentType,
  manifestContentType,
  OCIRegistryURLComponents,
  RulesOrigin,
} from './types';
import { EOL } from 'os';
import { UnsupportedEntitlementFlagError } from './assert-iac-options-flag';
import {
  extractOCIRegistryURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidManifestSchemaVersionError,
  InvalidRemoteRegistryURLError,
  UnsupportedEntitlementPullError,
} from './oci-pull';
import { initLocalCache, pull } from './measurable-methods';
import { config as userConfig } from '../../../../../lib/user-config';
import { isValidUrl } from './url-utils';
import { CustomError } from '../../../../../lib/errors';
import { getErrorStringCode } from './error-utils';
import {
  customRulesMessage,
  customRulesReportMessage,
} from '../../../../../lib/formatters/iac-output';

export async function initRules(
  iacOrgSettings: IacOrgSettings,
  options: IaCTestFlags,
): Promise<RulesOrigin> {
  let customRulesPath: string | undefined;
  let rulesOrigin: RulesOrigin = RulesOrigin.Internal;

  if (options.rules) {
    if (!iacOrgSettings.entitlements?.iacCustomRulesEntitlement) {
      throw new UnsupportedEntitlementFlagError(
        'rules',
        'iacCustomRulesEntitlement',
      );
    }
    customRulesPath = options.rules;
    rulesOrigin = RulesOrigin.Local;
  }

  const isOCIRegistryURLProvided = checkOCIRegistryURLProvided(iacOrgSettings);

  if (
    (isOCIRegistryURLProvided || customRulesPath) &&
    !(options.sarif || options.json)
  ) {
    let userMessage = `${customRulesMessage}${EOL}`;

    if (options.report) {
      userMessage += `${customRulesReportMessage}${EOL}`;
    }

    console.log(userMessage);
  }

  if (isOCIRegistryURLProvided && customRulesPath) {
    throw new FailedToExecuteCustomRulesError();
  }

  if (isOCIRegistryURLProvided) {
    if (!iacOrgSettings.entitlements?.iacCustomRulesEntitlement) {
      throw new UnsupportedEntitlementPullError('iacCustomRulesEntitlement');
    }
    customRulesPath = await pullIaCCustomRules(iacOrgSettings);
    rulesOrigin = RulesOrigin.Remote;
  }

  await initLocalCache({ customRulesPath });

  return rulesOrigin;
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
): Promise<string> {
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
    return await pull(ociRegistryURLComponents, opt);
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
