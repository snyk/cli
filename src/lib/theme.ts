import chalk from 'chalk';

export const Icon = {
  RUN: '►',
  VALID: '✔',
  ISSUE: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
};

// const SEVERITY_CRITICAL = '#ff0bob';
// const SEVERITY_HIGH = '#ff872f';
// const SEVERITY_MEDIUM = '#edd55e';
// const SEVERITY_LOW = '#bcbbc8';
//
// const STATUS_ERROR = '#ff872f';
// const STATUS_SUCCESS = '#00d200';
//
// const REACHABILITY_REACHABLE = '';
// const REACHABILITY_PARTIALLY = '';
// const REACHABILITY_NON_REACHABLE = '';
// const REACHABILITY_NO_INFO = '';

export const colour = {
  status: {
    error: (text: string) => chalk.red(text),
    success: (text: string) => chalk.green(text),
  },
  severity: {
    critical: (text: string) => chalk.magenta(text),
    high: (text: string) => chalk.red(text),
    medium: (text: string) => chalk.yellow(text),
    low: (text: string) => text,
  },
};
