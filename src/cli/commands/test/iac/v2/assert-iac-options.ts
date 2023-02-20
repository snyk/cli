import { existsSync } from 'fs';
import { extname } from 'path';
import { SEVERITIES, SEVERITY } from '../../../../../lib/snyk-test/common';

import { InvalidVarFilePath } from '../local-execution';
import {
  assertTerraformPlanModes,
  FlagError,
  FlagValueError,
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
  'var-file',
  'detectionDepth',
  'cloud-context',
  'snyk-cloud-environment',
  'custom-rules',
  'experimental',
  // PolicyOptions
  'ignore-policy',
  'policy-path',
  'report',
  'remote-repo-url',
  'target-name',
  'target-reference',
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

  if (options.severityThreshold) {
    assertSeverityOptions(options.severityThreshold);
  }

  if (options['var-file']) {
    assertVarFileOptions(options['var-file']);
  }

  if (options.scan) {
    assertTerraformPlanModes(options.scan as string);
  }

  if (options['cloud-context']) {
    assertCloudContextOptions(options['cloud-context']);
  }
}

function assertSeverityOptions(severity: SEVERITY) {
  const validSeverityOptions = SEVERITIES.map((s) => s.verboseName);

  if (!validSeverityOptions.includes(severity)) {
    throw new FlagValueError(
      'severityThreshold',
      severity,
      validSeverityOptions.join(', '),
    );
  }
}

function assertVarFileOptions(filePath: string) {
  if (!existsSync(filePath)) {
    throw new InvalidVarFilePath(filePath);
  }
  if (extname(filePath) !== '.tfvars') {
    throw new FlagValueError('var-file', filePath, '.tfvars file');
  }
}

function assertCloudContextOptions(cloudContext: string) {
  const validCloudContextOptions = ['aws'];

  if (!validCloudContextOptions.includes(cloudContext)) {
    throw new FlagValueError(
      'cloud-context',
      cloudContext,
      validCloudContextOptions.join(', '),
    );
  }
}
