import {
  assertTerraformPlanModes,
  FlagError,
} from '../local-execution/assert-iac-options-flag';
import { IaCTestFlags } from '../local-execution/types';

const keys: (keyof IaCTestFlags)[] = [
  'debug',
  'v',
  'version',
  'h',
  'help',
  'q',
  'quiet',
  'org',
  'insecure',
  'severityThreshold',
  'json',
  'sarif',
  'json-file-output',
  'sarif-file-output',
  'scan',
  'experimental',
  'var-file',
  'detectionDepth',
  // PolicyOptions
  'ignore-policy',
  'policy-path',
];
const allowed = new Set<string>(keys);

export function assertIacV2Options(options: IaCTestFlags): void {
  // We process the process.argv so we don't get default values.
  for (const key of Object.keys(options)) {
    // The _ property is a special case that contains non
    // flag strings passed to the command line (usually files)
    // and `iac` is the command provided.
    if (key !== '_' && key !== 'iac' && !allowed.has(key)) {
      throw new FlagError(key);
    }
  }

  if (options.scan) {
    assertTerraformPlanModes(options.scan as string);
  }
}
