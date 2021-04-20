import { CustomError } from '../../../../lib/errors';
import { args } from '../../../args';
import { IaCErrorCodes, IaCTestFlags } from './types';

const keys: (keyof IaCTestFlags)[] = [
  'debug',
  'insecure',
  'experimental',
  'detectionDepth',
  'severityThreshold',
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
];
const allowed = new Set<string>(keys);

function camelcaseToDash(key: string) {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

class FlagError extends CustomError {
  constructor(key: string) {
    const dashes = key.length === 1 ? '-' : '--';
    const flag = camelcaseToDash(key);
    const msg = `Unsupported flag "${dashes}${flag}" provided. Run snyk iac test --help for supported flags.`;
    super(msg);
    this.code = IaCErrorCodes.FlagError;
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
}
