import { color } from '../../../lib/theme';
import { TestOptions, Options } from '../../../lib/types';
import { FAIL_ON, FailOn, SEVERITIES } from '../../../lib/snyk-test/common';
import { FailOnError } from '../../../lib/errors/fail-on-error.ts';

export function validateTestOptions(options: TestOptions & Options) {
  if (
    options.severityThreshold &&
    !validateSeverityThreshold(options.severityThreshold)
  ) {
    throw new Error('INVALID_SEVERITY_THRESHOLD');
  }

  if (options.failOn && !validateFailOn(options.failOn)) {
    const error = new FailOnError();
    throw color.status.error(error.message);
  }
}

function validateSeverityThreshold(severityThreshold) {
  return SEVERITIES.map((s) => s.verboseName).indexOf(severityThreshold) > -1;
}

function validateFailOn(arg: FailOn) {
  return Object.keys(FAIL_ON).includes(arg);
}
