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

const toPlainText = (result: AdviseResult): string => {
  const deps = result.dependencies;
  const longestName = Math.max(...deps.map((d) => d.name.length));
  const title = chalk.bold(
    `${'Package'.padEnd(longestName)} ${scoreTitle} MaintenanceStatus`,
  );
  return title + '\n' + deps.map(depFormat(longestName)).join('\n');
};

const depFormat = (longestName: number): ((s: ScoredPackage) => string) => {
  const formatDependency = (dep: ScoredPackage): string => {
    return `${dep.name.padEnd(longestName)} ${score(dep.score)} ${maintenance(
      dep.maintenance,
    )}`;
  };
  return formatDependency;
};

const scoreTitle = 'Score';

const score = (s: number): string => {
  return chalk.bold(
    Math.round(100 * s)
      .toString()
      .padEnd(scoreTitle.length),
  );
};

const maintenance = (maint: Maintenance): string => {
  switch (maint) {
    case Maintenance.HEALTHY:
      return chalk.green(maint);
    case Maintenance.INACTIVE:
      return chalk.red(maint);
    case Maintenance.SUSTAINABLE:
      return chalk.yellow(maint);
  }
};
