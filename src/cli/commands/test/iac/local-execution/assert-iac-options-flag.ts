import { CustomError } from '../../../../../lib/errors';
import { args } from '../../../../args';
import { getErrorStringCode } from './error-utils';
import {
  IaCErrorCodes,
  IacOrgSettings,
  IaCTestFlags,
  TerraformPlanScanMode,
} from './types';
import { Options, TestOptions } from '../../../../../lib/types';
import { IacV2Name } from '../../../../../lib/iac/constants';
import { CLI } from '@snyk/error-catalog-nodejs-public';

const keys: (keyof IaCTestFlags)[] = [
  'org',
  'debug',
  'insecure',
  'detectionDepth',
  'severityThreshold',
  'rules',
  'json',
  'sarif',
  'json-file-output',
  'sarif-file-output',
  'v',
  'version',
  'h',
  'help',
  'q',
  'quiet',
  'scan',
  'report',
  // Tags and attributes
  'tags',
  'project-tags',
  'project-environment',
  'project-lifecycle',
  'project-business-criticality',
  'target-reference',
  'var-file',
  // PolicyOptions
  'ignore-policy',
  'policy-path',
  // Report options
  'remote-repo-url',
  'target-name',
];
const integratedKeys: (keyof IaCTestFlags)[] = ['snyk-cloud-environment'];

const allowed = new Set<string>(keys);
const integratedOnlyFlags = new Set<string>(integratedKeys);

function camelcaseToDash(key: string) {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

function getFlagName(key: string) {
  const dashes = key.length === 1 ? '-' : '--';
  const flag = camelcaseToDash(key);
  return `${dashes}${flag}`;
}

export class FlagError extends CustomError {
  constructor(key: string) {
    const flag = getFlagName(key);
    const msg = `Unsupported flag "${flag}" provided. Run snyk iac test --help for supported flags`;
    super(msg);
    this.code = IaCErrorCodes.FlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}

export class IntegratedFlagError extends CustomError {
  constructor(key: string, org: string) {
    const flag = getFlagName(key);
    const msg = `Flag "${flag}" is only supported when using ${IacV2Name}. To enable it for your organisation "${org}", please contact Snyk support.`;
    super(msg);
    this.code = IaCErrorCodes.FlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}

export class FeatureFlagError extends CustomError {
  constructor(key: string, featureFlag: string, hasSnykPreview?: boolean) {
    const flag = getFlagName(key);
    let msg;
    if (hasSnykPreview) {
      msg = `Flag "${flag}" is only supported if feature flag '${featureFlag}' is enabled. The feature flag can be enabled via Snyk Preview if you are on the Enterprise Plan`;
    } else {
      msg = `Flag "${flag}" is only supported if feature flag "${featureFlag}" is enabled. To enable it, please contact Snyk support.`;
    }
    super(msg);
    this.code = IaCErrorCodes.FeatureFlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}

export class FlagValueError extends CustomError {
  constructor(key: string, value: string, supportedValues: string) {
    const flag = getFlagName(key);
    const msg = `Unsupported value "${value}" provided to flag "${flag}".\nSupported values are: ${supportedValues}`;
    super(msg);
    this.code = IaCErrorCodes.FlagValueError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}

export class UnsupportedEntitlementFlagError extends CustomError {
  constructor(key: string, entitlementName: string) {
    const flag = getFlagName(key);
    const msg = `Flag "${flag}" is currently not supported for this org. To enable it, please contact snyk support.`;
    super(
      `Unsupported flag: ${flag} - Missing the ${entitlementName} entitlement`,
    );
    this.code = IaCErrorCodes.UnsupportedEntitlementFlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}

export class UnsupportedEntitlementCommandError extends CustomError {
  constructor(key: string, entitlementName: string) {
    const usrMsg = `Command "${key}" is currently not supported for this org. To enable it, please contact snyk support.`;
    super(
      `Unsupported command: ${key} - Missing the ${entitlementName} entitlement`,
    );
    this.code = IaCErrorCodes.UnsupportedEntitlementFlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = usrMsg;
    this.errorCatalog = new CLI.GeneralIACFailureError('');
  }
}

/**
 * Validates the command line flags passed to the snyk iac test
 * command. The current argument parsing is very permissive and
 * allows unknown flags to be provided without validation.
 *
 * For snyk iac we need to explicitly validate the flags to avoid
 * misconfigurations and typos. For example, if the --experimental
 * flag were to be misspelled we would end up sending the client
 * data to our backend rather than running it locally as intended.
 * @param argv command line args passed to the process
 */
export function assertIaCOptionsFlags(argv: string[]): void {
  // We process the process.argv so we don't get default values.
  const parsed = args(argv);
  for (const key of Object.keys(parsed.options)) {
    // The _ property is a special case that contains non
    // flag strings passed to the command line (usually files)
    // and `iac` is the command provided.
    if (key !== '_' && key !== 'iac' && !allowed.has(key)) {
      throw new FlagError(key);
    }
  }

  if (parsed.options.scan) {
    assertTerraformPlanModes(parsed.options.scan as string);
  }
}

/**
 * Check that the flags used for the v1 flow do not contain any flag that are
 * only usable with the new IaC+ flow
 * @param settings organisation settings, used to get the org name
 * @param argv command line args
 */
export function assertIntegratedIaCOnlyOptions(
  settings: IacOrgSettings,
  argv: string[],
): void {
  // We process the process.argv so we don't get default values.
  const parsed = args(argv);
  for (const key of Object.keys(parsed.options)) {
    // The _ property is a special case that contains non
    // flag strings passed to the command line (usually files)
    // and `iac` is the command provided.
    if (key !== '_' && key !== 'iac' && integratedOnlyFlags.has(key)) {
      throw new IntegratedFlagError(key, settings.meta.org);
    }
  }
}

const SUPPORTED_TF_PLAN_SCAN_MODES = [
  TerraformPlanScanMode.DeltaScan,
  TerraformPlanScanMode.FullScan,
];

export function assertTerraformPlanModes(scanModeArgValue: string) {
  if (
    !SUPPORTED_TF_PLAN_SCAN_MODES.includes(
      scanModeArgValue as TerraformPlanScanMode,
    )
  ) {
    throw new FlagValueError(
      'scan',
      scanModeArgValue,
      SUPPORTED_TF_PLAN_SCAN_MODES.join(', '),
    );
  }
}

export function isIacShareResultsOptions(
  options: Options & TestOptions,
): boolean | undefined {
  return options.iac && options.report;
}
export class InvalidArgumentError extends CustomError {
  constructor(key: string) {
    const flag = getFlagName(key);
    const msg = `Invalid argument provided to flag "${flag}". Value must be a string`;
    super(msg);
    this.code = IaCErrorCodes.InvalidArgumentError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
    this.errorCatalog = new CLI.InvalidFlagOptionError('');
  }
}
