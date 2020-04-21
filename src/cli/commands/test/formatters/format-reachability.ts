import * as wrap from 'wrap-ansi';
import chalk from 'chalk';

import { REACHABILITY } from '../../../../lib/snyk-test/legacy';

const reachabilityLevels: {
  [key in REACHABILITY]: { color: Function; text: string };
} = {
  [REACHABILITY.FUNCTION]: {
    color: chalk.redBright,
    text: 'Likely reachable',
  },
  [REACHABILITY.PACKAGE]: {
    color: chalk.yellow,
    text: '', // Not supported ATM
  },
  [REACHABILITY.UNREACHABLE]: {
    color: chalk.blueBright,
    text: 'Likely unreachable',
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
