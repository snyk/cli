import * as config from '../config';
import chalk from 'chalk';

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

export const severitiesColourMapping = {
  low: {
    colorFunc(text) {
      return chalk.blueBright(text);
    },
  },
  medium: {
    colorFunc(text) {
      return chalk.yellowBright(text);
    },
  },
  high: {
    colorFunc(text) {
      return chalk.redBright(text);
    },
  },
  critical: {
    colorFunc(text) {
      return chalk.magentaBright(text);
    },
  },
};

export const legacySeveritiesColourMapping = {
  low: {
    colorFunc(text) {
      return chalk.bold.blue(text);
    },
  },
  medium: {
    colorFunc(text) {
      return chalk.bold.yellow(text);
    },
  },
  high: {
    colorFunc(text) {
      return chalk.bold.red(text);
    },
  },
  critical: {
    colorFunc(text) {
      return chalk.bold.magenta(text);
    },
  },
};

export const defaultSeverityColor = {
  colorFunc(text) {
    return chalk.grey(text);
  },
};

export function getSeveritiesColour(severity: string) {
  return severitiesColourMapping[severity] || defaultSeverityColor;
}

export function getLegacySeveritiesColour(severity: string) {
  return legacySeveritiesColourMapping[severity] || defaultSeverityColor;
}

export enum FAIL_ON {
  all = 'all',
  upgradable = 'upgradable',
  patchable = 'patchable',
}

export type FailOn = 'all' | 'upgradable' | 'patchable';
