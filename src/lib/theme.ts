import chalk from 'chalk';

export const icon = {
  RUN: '►',
  VALID: '✔',
  ISSUE: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
};

export const color = {
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
