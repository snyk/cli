import * as utils from '../../../src/cli/commands/test/utils';
import { test } from 'tap';
import { TestResult } from '../../../src/lib/snyk-test/legacy';

test('project name is undefined', (t) => {
  t.plan(1);

  const testResult: TestResult = {
    vulnerabilities: [],
    ok: true,
    dependencyCount: 0,
    org: 'test-org',
    policy: 'test-policy',
    isPrivate: true,
    licensesPolicy: null,
    packageManager: 'test-packageManager',
    ignoreSettings: null,
    summary: 'test-summary',
    projectName: '',
  };

  const res = utils.getPathWithOptionalProjectName('/tmp/hydra', testResult);
  t.equal(res, '/tmp/hydra');
});

test('project name has no sub dir', (t) => {
  t.plan(1);

  const testResult: TestResult = {
    vulnerabilities: [],
    ok: true,
    dependencyCount: 0,
    org: 'test-org',
    policy: 'test-policy',
    isPrivate: true,
    licensesPolicy: null,
    packageManager: 'test-packageManager',
    ignoreSettings: null,
    summary: 'test-summary',
    projectName: 'hydra',
  };

  const res = utils.getPathWithOptionalProjectName('/tmp/hydra', testResult);
  t.equal(res, '/tmp/hydra');
});

test('project name has sub dir', (t) => {
  t.plan(1);

  const testResult: TestResult = {
    vulnerabilities: [],
    ok: true,
    dependencyCount: 0,
    org: 'test-org',
    policy: 'test-policy',
    isPrivate: true,
    licensesPolicy: null,
    packageManager: 'test-packageManager',
    ignoreSettings: null,
    summary: 'test-summary',
    projectName: 'hydra/subdir',
  };

  const res = utils.getPathWithOptionalProjectName('/tmp/hydra', testResult);
  t.equal(res, '/tmp/hydra/subdir');
});
