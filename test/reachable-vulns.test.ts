import { test } from 'tap';
import * as sinon from 'sinon';

import {
  formatReachability,
  summariseReachableVulns,
  getReachabilityText,
  formatReachablePaths,
  formatReachablePath,
} from '../src/lib/formatters/format-reachability';
import { AnnotatedIssue, REACHABILITY } from '../src/lib/snyk-test/legacy';
import {
  serializeCallGraphWithMetrics,
  validatePayload,
} from '../src/lib/reachable-vulns';
import {
  SUPPORTED_PACKAGE_MANAGER_NAME,
  REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS,
  SupportedPackageManagers,
} from '../src/lib/package-managers';
import * as featureFlags from '../src/lib/feature-flags';
import * as utils from './utils';

test('output formatting', (t) => {
  t.equal(formatReachability(REACHABILITY.FUNCTION), '[Reachable]');
  t.equal(formatReachability(REACHABILITY.PACKAGE), '[Potentially reachable]');
  t.equal(formatReachability(REACHABILITY.NOT_REACHABLE), '[Not reachable]');
  t.equal(formatReachability(REACHABILITY.NO_INFO), '');
  t.equal(formatReachability(undefined), '');
  t.end();
});

test('reachable text', (t) => {
  t.equal(getReachabilityText(REACHABILITY.FUNCTION), 'Reachable');
  t.equal(getReachabilityText(REACHABILITY.PACKAGE), 'Potentially reachable');
  t.equal(getReachabilityText(REACHABILITY.NOT_REACHABLE), 'Not reachable');
  t.equal(getReachabilityText(REACHABILITY.NO_INFO), '');
  t.equal(getReachabilityText(undefined), '');
  t.end();
});

test('formatReachabilitySummaryText', (t) => {
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

  t.equal(
    summariseReachableVulns([]),
    '',
    'no vulnerabilities should not display anything',
  );

  t.equal(
    summariseReachableVulns([noReachabilityMetadata]),
    '',
    'no reachability metadata should not display anything',
  );

  t.equal(
    summariseReachableVulns([noInfoVuln]),
    '',
    'no info should not display anything',
  );

  t.equal(
    summariseReachableVulns([notReachableVuln]),
    '',
    'not reachable is not implemented yet, should not display anything',
  );

  t.equal(
    summariseReachableVulns([reachableByPackageVuln]),
    '',
    'package is not implemented yet, should not display anything',
  );

  t.equal(
    summariseReachableVulns([reachableByFunctionVuln]),
    'In addition, found 1 vulnerability with a reachable path.',
    'one reachable function summary text',
  );

  t.equal(
    summariseReachableVulns([reachableByFunctionVuln, reachableByFunctionVuln]),
    'In addition, found 2 vulnerabilities with a reachable path.',
    'two reachable functions summary text',
  );

  t.equal(
    summariseReachableVulns([
      reachableByFunctionVuln,
      reachableByFunctionVuln,
      reachableByPackageVuln,
      noInfoVuln,
    ]),
    'In addition, found 2 vulnerabilities with a reachable path.',
    'two reachable functions and no info one, should count only the function reachable once',
  );

  t.end();
});

test('formatReachablePaths', (t) => {
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

  t.equal(
    formatReachablePaths(reachablePaths, 0, reachablePathsTemplate),
    reachablePathsTemplate([], 3),
  );

  t.equal(
    formatReachablePaths(reachablePaths, 2, reachablePathsTemplate),
    reachablePathsTemplate(
      reachablePaths.paths.slice(0, 2).map(formatReachablePath),
      1,
    ),
  );

  t.equal(
    formatReachablePaths(reachablePaths, 5, reachablePathsTemplate),
    reachablePathsTemplate(reachablePaths.paths.map(formatReachablePath), 0),
  );

  t.equal(
    formatReachablePaths(noReachablePaths, 2, reachablePathsTemplate),
    reachablePathsTemplate([], 0),
  );

  t.end();
});

test('validatePayload - not supported package manager', async (t) => {
  const pkgManagers = Object.keys(SUPPORTED_PACKAGE_MANAGER_NAME).filter(
    (name) =>
      !REACHABLE_VULNS_SUPPORTED_PACKAGE_MANAGERS.includes(
        name as SupportedPackageManagers,
      ),
  );
  t.plan(pkgManagers.length * 3);

  for (const pkgManager of pkgManagers) {
    try {
      await validatePayload(
        {},
        { path: '' },
        pkgManager as SupportedPackageManagers,
      );
      t.fail(`${pkgManager} should not be supported for reachable vulns`);
    } catch (err) {
      t.equal(
        err.message,
        `Unsupported package manager ${pkgManager} for Reachable vulns.`,
        'correct error message',
      );
      t.equal(
        err.userMessage,
        `'Reachable vulns' is not supported for package manager '${pkgManager}'. For a list of supported package managers go to https://support.snyk.io/hc/en-us/articles/360010554837-Reachable-Vulnerabilities`,
        'correct error message',
      );
      t.equal(err.code, 422, 'correct error code');
    }
  }
});

test('validatePayload - supported package manager (maven) no feature flag', async (t) => {
  const userMessage = 'feature is not supported';
  const isFeatureFlagSupportedForOrgStub = sinon
    .stub(featureFlags, 'isFeatureFlagSupportedForOrg')
    .resolves({ userMessage });

  try {
    await validatePayload({}, { path: '' }, 'maven');
  } catch (err) {
    t.equal(err.code, 403, 'correct error code');
    t.equal(err.userMessage, userMessage, 'correct user message ');
  } finally {
    isFeatureFlagSupportedForOrgStub.restore();
  }
});

test('validatePayload - supported package manager (maven) with feature flag', async (t) => {
  const isFeatureFlagSupportedForOrgStub = sinon
    .stub(featureFlags, 'isFeatureFlagSupportedForOrg')
    .resolves({ ok: true });
  const org = { name: 'org-with-reachable-vulns-ff' };

  t.tearDown(() => {
    isFeatureFlagSupportedForOrgStub.restore();
  });

  const valid = await validatePayload(org, { path: '' }, 'maven');

  t.true(valid, 'payload is valid');

  t.true(
    isFeatureFlagSupportedForOrgStub.calledOnce,
    'called is feature flag only once',
  );
  const [featureFlagArg, orgArg] = isFeatureFlagSupportedForOrgStub.getCall(
    0,
  ).args;
  t.equal(featureFlagArg, 'reachableVulns', 'correct feature flag passed');
  t.deepEqual(orgArg, org, 'correct org payload passed');
});

test('validatePayload - package manager not specified in case of --all-projects flag', async (t) => {
  const isFeatureFlagSupportedForOrgStub = sinon
    .stub(featureFlags, 'isFeatureFlagSupportedForOrg')
    .resolves({ ok: true });
  const org = { name: 'org-with-reachable-vulns-ff' };

  t.tearDown(() => {
    isFeatureFlagSupportedForOrgStub.restore();
  });

  const valid = await validatePayload(org, { path: '' });

  t.true(valid, 'payload is valid');
});

test('serializeCallGraphWithMetrics', (t) => {
  const callGraphFixture = require('./fixtures/call-graphs/maven.json');
  const callGraph = utils.createCallGraph(callGraphFixture);
  const {
    callGraph: callGraphRes,
    nodeCount,
    edgeCount,
  } = serializeCallGraphWithMetrics(callGraph);
  t.deepEqual(callGraphRes, callGraphFixture, 'correct call graph');
  t.equal(nodeCount, 4, 'correct node count');
  t.equal(edgeCount, 2, 'correct edge count');

  t.end();
});
