import * as wrap from 'wrap-ansi';
import chalk from 'chalk';

import { AnnotatedIssue, REACHABILITY } from '../../../../lib/snyk-test/legacy';

const reachabilityLevels: {
  [key in REACHABILITY]: { color: Function; text: string };
} = {
  [REACHABILITY.FUNCTION]: {
    color: chalk.redBright,
    text: 'Reachable',
  },
  [REACHABILITY.PACKAGE]: {
    color: chalk.yellow,
    text: 'Potentially reachable',
  },
  [REACHABILITY.NOT_REACHABLE]: {
    color: chalk.blueBright,
    text: 'Not reachable',
  },
  [REACHABILITY.NO_INFO]: {
    color: (str) => str,
    text: '',
  },
};

export function formatReachability(reachability?: REACHABILITY): string {
  if (!reachability) {
    return '';
  }
  const reachableInfo = reachabilityLevels[reachability];
  const textFunc = reachableInfo ? reachableInfo.color : (str) => str;
  const text =
    reachableInfo && reachableInfo.text ? `[${reachableInfo.text}]` : '';

  return wrap(textFunc(text), 100);
}

export function getReachabilityText(reachability?: REACHABILITY): string {
  if (!reachability) {
    return '';
  }
  const reachableInfo = reachabilityLevels[reachability];
  return reachableInfo ? reachableInfo.text : '';
}

export function summariseReachableVulns(
  vulnerabilities: AnnotatedIssue[],
): string {
  const reachableVulnsCount = vulnerabilities.filter(
    (v) => v.reachability === REACHABILITY.FUNCTION,
  ).length;

  if (reachableVulnsCount > 0) {
    const vulnText =
      reachableVulnsCount === 1 ? 'vulnerability' : 'vulnerabilities';
    return `In addition, found ${reachableVulnsCount} ${vulnText} with a reachable path.`;
  }

  return '';
}
