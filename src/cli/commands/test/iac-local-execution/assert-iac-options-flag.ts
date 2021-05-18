import { CustomError } from '../../../../lib/errors';
import { args } from '../../../args';
import { getErrorStringCode } from './error-utils';
import { IaCErrorCodes, IaCTestFlags, TerraformPlanScanMode } from './types';

const keys: (keyof IaCTestFlags)[] = [
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
  'legacy',
];
const allowed = new Set<string>(keys);

function camelcaseToDash(key: string) {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

function getFlagName(key: string) {
  const dashes = key.length === 1 ? '-' : '--';
  const flag = camelcaseToDash(key);
  return `${dashes}${flag}`;
}

class FlagError extends CustomError {
  constructor(key: string) {
    const flag = getFlagName(key);
    const msg = `Unsupported flag "${flag}" provided. Run snyk iac test --help for supported flags.`;
    super(msg);
    this.code = IaCErrorCodes.FlagError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
  }
}

export class FlagValueError extends CustomError {
  constructor(key: string, value: string) {
    const flag = getFlagName(key);
    const msg = `Unsupported value "${value}" provided to flag "${flag}".\nSupported values are: ${SUPPORTED_TF_PLAN_SCAN_MODES.join(
      ', ',
    )}`;
    super(msg);
    this.code = IaCErrorCodes.FlagValueError;
    this.strCode = getErrorStringCode(this.code);
    this.userMessage = msg;
  }
}

/**
 * Validates the command line flags passed to the snyk iac test
 * command. The current argument parsing is very permissive and
 * allows unknown flags to be provided without valdiation.
 *
 * For snyk iac we need to explictly validate the flags to avoid
 * misconfigurations and typos. For example, if the --experimental
 * flag were to be mis-spelled we would end up sending the client
 * data to our backend rather than running it locally as intended.
 * @param argv command line args passed to the process
 */
export function assertIaCOptionsFlags(argv: string[]) {
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

const SUPPORTED_TF_PLAN_SCAN_MODES = [
  TerraformPlanScanMode.DeltaScan,
  TerraformPlanScanMode.FullScan,
];

function assertTerraformPlanModes(scanModeArgValue: string) {
  if (
    !SUPPORTED_TF_PLAN_SCAN_MODES.includes(
      scanModeArgValue as TerraformPlanScanMode,
    )
  ) {
    throw new FlagValueError('scan', scanModeArgValue);
  }
}
