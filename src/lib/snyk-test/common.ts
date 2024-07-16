import config from '../config';
import { color } from '../theme';
import { DepGraphData } from '@snyk/dep-graph';
import { jsonStringifyLargeObject } from '../json';
import { JsonStreamStringify } from 'json-stream-stringify';

export function assembleQueryString(options) {
  const org = options.org || config.org || null;
  const qs: {
    org: string;
    severityThreshold?: boolean;
    ignorePolicy?: boolean;
  } = {
    org,
  };

  if (options.severityThreshold) {
    qs.severityThreshold = options.severityThreshold;
  }
  if (options['ignore-policy']) {
    qs.ignorePolicy = true;
  }

  return Object.keys(qs).length !== 0 ? qs : null;
}

export enum SEVERITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}
export const SEVERITIES: Array<{
  verboseName: SEVERITY;
  value: number;
}> = [
  {
    verboseName: SEVERITY.LOW,
    value: 1,
  },
  {
    verboseName: SEVERITY.MEDIUM,
    value: 2,
  },
  {
    verboseName: SEVERITY.HIGH,
    value: 3,
  },
  {
    verboseName: SEVERITY.CRITICAL,
    value: 4,
  },
];

export function colorTextBySeverity(
  severity: string,
  textToColor: string,
): string {
  return (color.severity[(severity || '').toLowerCase()] || color.severity.low)(
    textToColor,
  );
}

export enum FAIL_ON {
  all = 'all',
  upgradable = 'upgradable',
  patchable = 'patchable',
}

export type FailOn = 'all' | 'upgradable' | 'patchable';

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAY = 500;

// depGraphData formats the given depGrahData with the targetName as expected by
// the `depgraph` CLI workflow.
export function depGraphToOutputString(
  dg: DepGraphData,
  targetName: string,
): string {
  return `DepGraph data:
${jsonStringifyLargeObject(dg)}
DepGraph target:
${targetName}
DepGraph end`;
}

export function depGraphToOutputStream(
  dg: DepGraphData,
  targetName: string,
  out: NodeJS.WritableStream,
): void {
  out.write(`DepGraph data:\n`);
  new JsonStreamStringify(dg).pipe(out);
  out.write(`
DepGraph target:
${targetName}
DepGraph end`);
}
