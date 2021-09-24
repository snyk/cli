import { test } from 'tap';
import stripAnsi = require('strip-ansi');

import {
  formatReachability,
  summariseReachableVulns,
  getReachabilityText,
  formatReachablePaths,
  formatReachablePath,
} from '../../../../../src/lib/formatters/format-reachability';
import {
  AnnotatedIssue,
  REACHABILITY,
} from '../../../../../src/lib/snyk-test/legacy';

describe('Format Reachable Vulns', () => {
  it('output formatting', () => {
    expect(stripAnsi(formatReachability(REACHABILITY.FUNCTION))).toEqual(
      '[Reachable]',
    );
    expect(stripAnsi(formatReachability(REACHABILITY.PACKAGE))).toEqual(
      '[Potentially reachable]',
    );
    expect(stripAnsi(formatReachability(REACHABILITY.NOT_REACHABLE))).toEqual(
      '[Not reachable]',
    );
    expect(formatReachability(REACHABILITY.NO_INFO)).toEqual('');
    expect(formatReachability(undefined)).toEqual('');
  });

  test('reachable text', () => {
    expect(getReachabilityText(REACHABILITY.FUNCTION)).toEqual('Reachable');
    expect(getReachabilityText(REACHABILITY.PACKAGE)).toEqual(
      'Potentially reachable',
    );
    expect(getReachabilityText(REACHABILITY.NOT_REACHABLE)).toEqual(
      'Not reachable',
    );
    expect(getReachabilityText(REACHABILITY.NO_INFO)).toEqual('');
    expect(getReachabilityText(undefined)).toEqual('');
  });

  test('formatReachabilitySummaryText', () => {
    const noReachabilityMetadata = {} as AnnotatedIssue;
    const noInfoVuln = { reachability: REACHABILITY.NO_INFO } as AnnotatedIssue;
    const notReachableVuln = {
      reachability: REACHABILITY.NOT_REACHABLE,
    } as AnnotatedIssue;
    const reachableByPackageVuln = {
      reachability: REACHABILITY.PACKAGE,
    } as AnnotatedIssue;
    const reachableByFunctionVuln = {
      reachability: REACHABILITY.FUNCTION,
    } as AnnotatedIssue;

    expect(summariseReachableVulns([])).toEqual('');

    expect(summariseReachableVulns([noReachabilityMetadata])).toEqual('');

    expect(summariseReachableVulns([noInfoVuln])).toEqual('');

    expect(summariseReachableVulns([notReachableVuln])).toEqual('');

    expect(summariseReachableVulns([reachableByPackageVuln])).toEqual('');

    expect(summariseReachableVulns([reachableByFunctionVuln])).toEqual(
      'In addition, found 1 vulnerability with a reachable path.',
    );

    expect(
      summariseReachableVulns([
        reachableByFunctionVuln,
        reachableByFunctionVuln,
      ]),
    ).toEqual('In addition, found 2 vulnerabilities with a reachable path.');

    expect(
      summariseReachableVulns([
        reachableByFunctionVuln,
        reachableByFunctionVuln,
        reachableByPackageVuln,
        noInfoVuln,
      ]),
    ).toEqual('In addition, found 2 vulnerabilities with a reachable path.');
  });

  test('formatReachablePaths', () => {
    function reachablePathsTemplate(
      samplePaths: string[],
      extraPathsCount: number,
    ): string {
      if (samplePaths.length === 0) {
        return `\n    reachable via at least ${extraPathsCount} paths`;
      }
      let reachableVia = '\n    reachable via:\n';
      for (const p of samplePaths) {
        reachableVia += `    ${p}\n`;
      }
      if (extraPathsCount > 0) {
        reachableVia += `    and at least ${extraPathsCount} other path(s)`;
      }
      return reachableVia;
    }

    const noReachablePaths = {
      pathCount: 0,
      paths: [],
    };

    const reachablePaths = {
      pathCount: 3,
      paths: [
        ['f', 'g', 'h', 'i', 'j', 'vulnFunc1'],
        ['k', 'l', 'm', 'n', 'o', 'vulnFunc1'],
        ['p', 'q', 'r', 's', 't', 'vulnFunc2'],
      ],
    };

    expect(
      formatReachablePaths(reachablePaths, 0, reachablePathsTemplate),
    ).toEqual(reachablePathsTemplate([], 3));

    expect(
      formatReachablePaths(reachablePaths, 2, reachablePathsTemplate),
    ).toEqual(
      reachablePathsTemplate(
        reachablePaths.paths.slice(0, 2).map(formatReachablePath),
        1,
      ),
    );

    expect(
      formatReachablePaths(reachablePaths, 5, reachablePathsTemplate),
    ).toEqual(
      reachablePathsTemplate(reachablePaths.paths.map(formatReachablePath), 0),
    );

    expect(
      formatReachablePaths(noReachablePaths, 2, reachablePathsTemplate),
    ).toEqual(reachablePathsTemplate([], 0));
  });
});
