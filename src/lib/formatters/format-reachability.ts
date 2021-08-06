import * as wrap from 'wrap-ansi';
import chalk from 'chalk';

import {
  AnnotatedIssue,
  CallPath,
  REACHABILITY,
} from '../../lib/snyk-test/legacy';
import { SampleReachablePaths } from './types';
import {
  CALL_PATH_LEADING_ELEMENTS,
  PATH_SEPARATOR,
  CALL_PATH_TRAILING_ELEMENTS,
  PATH_HIDDEN_ELEMENTS,
} from '../constants';

const reachabilityLevels: {
  [key in REACHABILITY]: {
    color: (s: string) => string;
    text: string;
    json: string;
  };
} = {
  [REACHABILITY.FUNCTION]: {
    color: chalk.redBright,
    text: 'Reachable',
    json: 'reachable',
  },
  [REACHABILITY.PACKAGE]: {
    color: chalk.yellow,
    text: 'Potentially reachable',
    json: 'potentially-reachable',
  },
  [REACHABILITY.NOT_REACHABLE]: {
    color: chalk.blueBright,
    text: 'Not reachable',
    json: 'not-reachable',
  },
  [REACHABILITY.NO_INFO]: {
    color: (str) => str,
    text: '',
    json: 'no-path-found',
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

export function getReachabilityJson(reachability?: REACHABILITY): string {
  if (!reachability) {
    return '';
  }
  const reachableInfo = reachabilityLevels[reachability];
  return reachableInfo ? reachableInfo.json : '';
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

function getDistinctReachablePaths(
  reachablePaths: CallPath[],
  maxPathCount: number,
): string[] {
  const uniquePaths = new Set<string>();
  for (const path of reachablePaths) {
    if (uniquePaths.size >= maxPathCount) {
      break;
    }
    uniquePaths.add(formatReachablePath(path));
  }
  return Array.from(uniquePaths.values());
}

export function formatReachablePaths(
  sampleReachablePaths: SampleReachablePaths | undefined,
  maxPathCount: number,
  template: (samplePaths: string[], extraPathsCount: number) => string,
): string {
  const paths = sampleReachablePaths?.paths || [];
  const pathCount = sampleReachablePaths?.pathCount || 0;
  const distinctPaths = getDistinctReachablePaths(paths, maxPathCount);
  const extraPaths = pathCount - distinctPaths.length;

  return template(distinctPaths, extraPaths);
}

export function formatReachablePath(path: CallPath): string {
  const head = path.slice(0, CALL_PATH_LEADING_ELEMENTS).join(PATH_SEPARATOR);
  const tail = path
    .slice(path.length - CALL_PATH_TRAILING_ELEMENTS, path.length)
    .join(PATH_SEPARATOR);
  return `${head}${PATH_SEPARATOR}${PATH_HIDDEN_ELEMENTS}${PATH_SEPARATOR}${tail}`;
}
