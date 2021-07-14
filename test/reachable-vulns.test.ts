import { test } from 'tap';
import * as sinon from 'sinon';

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
