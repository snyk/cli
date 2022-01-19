import {
  AdviseResult,
  Maintenance,
  ScoredPackage,
} from '../../../lib/advisor/types';
import { CommandResult } from '../types';
import chalk from 'chalk';

export const formatAdviseResult = (result: AdviseResult): CommandResult => {
  return new CommandResult(toPlainText(result));
};

const scoreTitle = 'Score';
const maintenanceTitle = 'Maintenance Status';
const popularityTitle = 'Popularity';
const columnSeparator = ' | ';

const toPlainText = (result: AdviseResult): string => {
  const deps = result.dependencies;
  const longestName = Math.max(...deps.map((d) => d.name.length));
  const title = chalk.bold(
    [
      'Package'.padEnd(longestName),
      scoreTitle,
      maintenanceTitle,
      popularityTitle,
    ].join(columnSeparator),
  );
  const bar = ''.padEnd(title.length, '-');
  return (
    title + '\n' + bar + '\n' + deps.map(depFormat(longestName)).join('\n')
  );
};

const depFormat = (longestName: number): ((s: ScoredPackage) => string) => {
  const formatDependency = (dep: ScoredPackage): string => {
    return [
      dep.name.padEnd(longestName),
      score(dep.score),
      maintenance(dep.maintenance),
      dep.popularity,
    ].join(columnSeparator);
  };
  return formatDependency;
};

const score = (s: number): string => {
  return chalk.bold(
    Math.round(100 * s)
      .toString()
      .padEnd(scoreTitle.length),
  );
};

const maintenance = (maint: Maintenance): string => {
  const padded = maint.padEnd(maintenanceTitle.length);
  switch (maint) {
    case Maintenance.HEALTHY:
      return chalk.green(padded);
    case Maintenance.INACTIVE:
      return chalk.red(padded);
    case Maintenance.SUSTAINABLE:
      return chalk.yellow(padded);
  }
};
