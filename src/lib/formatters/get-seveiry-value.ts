import { SEVERITIES, SEVERITY } from '../snyk-test/common';

export function getSeverityValue(severity: SEVERITY): number {
  return SEVERITIES.find((s) => s.verboseName === severity)!.value;
}
