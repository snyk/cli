import { filterIgnoredIssues } from '../../../../src/cli/commands/test/iac-local-execution/policy';
import { FormattedResult } from '../../../../src/cli/commands/test/iac-local-execution/types';
import fs = require('fs');
import path from 'path';
import snykPolicy from 'snyk-policy';
const cloneDeep = require('lodash.clonedeep');

async function filterFixture(policyName: string) {
  const policy = await loadPolicy(policyName);

  const fixtureContent = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'formatted-results.json'),
    'utf-8',
  );
  const fixture: FormattedResult[] = JSON.parse(fixtureContent);

  // The policy library modifies its input. In order to write meaningful
  // assertions, deep-clone the original fixture.
  const filtered = filterIgnoredIssues(policy, cloneDeep(fixture));

  return {
    fixture: fixture,
    filtered: filtered.filteredIssues,
    ignoreCount: filtered.ignoreCount,
  };
}

async function loadPolicy(policyName: string) {
  if (policyName === '') {
    return null;
  }
  const policyPath = path.join(__dirname, 'fixtures', policyName);
  const policyText = fs.readFileSync(policyPath, 'utf-8');
  return await snykPolicy.loadFromText(policyText);
}

function assertK8sPolicyPruned(
  fixture: FormattedResult[],
  filtered: FormattedResult[],
) {
  expect(filtered[0]).toEqual(fixture[0]);
  expect(filtered[1]).toEqual(fixture[1]);
  const k8sFixture = fixture[2].result.cloudConfigResults;
  const k8sResults = filtered[2].result.cloudConfigResults;
  expect(k8sResults).toHaveLength(k8sFixture.length - 1);
  expect(k8sResults.some((e) => e.id === 'SNYK-CC-K8S-1')).toEqual(false);
}

describe('filtering ignored issues', () => {
  it('returns the original issues when policy is not loaded', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture('');
    expect(filtered).toEqual(fixture);
    expect(ignoreCount).toEqual(0);
  });

  it('filters ignored issues when path=*', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-star.yml',
    );
    assertK8sPolicyPruned(fixture, filtered);
    expect(ignoreCount).toEqual(1);
  });

  // This might seem paranoid, but given that our handling of resource paths is
  // in a state of flux, e.g. to support multi-doc YAML properly, having some
  // regression tests around each currently supported config type might be wise.
  describe('filtering ignored issues by resource path', () => {
    it('filters ignored issues when path is resource path (Kubernetes)', async () => {
      const { fixture, filtered, ignoreCount } = await filterFixture(
        'policy-ignore-resource-path-kubernetes.yml',
      );
      assertK8sPolicyPruned(fixture, filtered);
      expect(ignoreCount).toEqual(1);
    });

    it('filters ignored issues when path is resource path (CloudFormation)', async () => {
      const { fixture, filtered, ignoreCount } = await filterFixture(
        'policy-ignore-resource-path-cloudformation.yml',
      );
      expect(filtered[0]).toEqual(fixture[0]);
      expect(filtered[2]).toEqual(fixture[2]);
      const cfFixture = fixture[1].result.cloudConfigResults;
      const cfResults = filtered[1].result.cloudConfigResults;
      expect(cfResults).toHaveLength(cfFixture.length - 1);
      expect(cfResults.some((e) => e.id === 'SNYK-CC-TF-53')).toEqual(false);
      expect(ignoreCount).toEqual(1);
    });

    it('filters ignored issues when path is resource path (Terraform)', async () => {
      const { fixture, filtered, ignoreCount } = await filterFixture(
        'policy-ignore-resource-path-terraform.yml',
      );
      expect(filtered[1]).toEqual(fixture[1]);
      expect(filtered[2]).toEqual(fixture[2]);
      const tfFixture = fixture[0].result.cloudConfigResults;
      const tfResults = filtered[0].result.cloudConfigResults;
      expect(tfResults).toHaveLength(tfFixture.length - 1);
      expect(ignoreCount).toEqual(1);
    });
  });

  it('filters no issues when path is non-matching resource path', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-resource-path-non-matching.yml',
    );
    expect(filtered).toEqual(fixture);
    expect(ignoreCount).toEqual(0);
  });

  it('filters ignored issues when path is file path', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-file-path.yml',
    );
    assertK8sPolicyPruned(fixture, filtered);
    expect(ignoreCount).toEqual(1);
  });

  it('filters no issues when path is file path in the wrong directory', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-file-path-wrong-dir.yml',
    );
    expect(filtered).toEqual(fixture);
    expect(ignoreCount).toEqual(0);
  });

  it('filters no issues when path is non-matching file path', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-file-path-non-matching.yml',
    );
    expect(filtered).toEqual(fixture);
    expect(ignoreCount).toEqual(0);
  });

  it('filters no issues when path is non-matching file path but matching resource path', async () => {
    const { fixture, filtered, ignoreCount } = await filterFixture(
      'policy-ignore-non-matching-file-matching-resource.yml',
    );
    expect(filtered).toEqual(fixture);
    expect(ignoreCount).toEqual(0);
  });
});
