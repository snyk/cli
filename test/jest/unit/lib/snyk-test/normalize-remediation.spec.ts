import * as cloneDeep from 'lodash.clonedeep';
import * as fs from 'fs';
import { createFromJSON } from '@snyk/dep-graph';
import { extractDataToSendFromResults } from '../../../../../src/lib/formatters/test/format-test-results';
import { formatIssuesWithRemediation } from '../../../../../src/lib/formatters/remediation-based-format-issues';
import {
  convertTestDepGraphResultToLegacy,
  normalizeRemediationChanges,
  RemediationChanges,
  TestDepGraphResponse,
} from '../../../../../src/lib/snyk-test/legacy';
import { Options, TestOptions } from '../../../../../src/lib/types';
import { getFixturePath } from '../../../util/getFixturePath';

function remediationMissingPatchSubField(): RemediationChanges {
  return {
    upgrade: {},
    pin: {},
    unresolved: [],
    ignore: {},
  } as unknown as RemediationChanges;
}

function lodashProjectDepGraph() {
  return createFromJSON({
    schemaVersion: '1.2.0',
    pkgManager: { name: 'npm' },
    pkgs: [
      {
        id: 'with-vulnerable-lodash-dep@1.2.3',
        info: { name: 'with-vulnerable-lodash-dep', version: '1.2.3' },
      },
      { id: 'lodash@4.17.15', info: { name: 'lodash', version: '4.17.15' } },
    ],
    graph: {
      rootNodeId: 'with-vulnerable-lodash-dep@1.2.3',
      nodes: [
        {
          nodeId: 'with-vulnerable-lodash-dep@1.2.3',
          pkgId: 'with-vulnerable-lodash-dep@1.2.3',
          deps: [{ nodeId: 'lodash@4.17.15' }],
        },
        { nodeId: 'lodash@4.17.15', pkgId: 'lodash@4.17.15', deps: [] },
      ],
    },
  });
}

describe('normalizeRemediationChanges', () => {
  it('returns undefined when remediation is absent', () => {
    expect(normalizeRemediationChanges(undefined)).toBeUndefined();
  });

  it('adds empty defaults for missing sub-fields', () => {
    const remediation = {
      upgrade: { 'lodash@4.17.15': { upgradeTo: 'lodash@4.17.21' } },
      pin: {},
      unresolved: [],
      ignore: {},
    } as unknown as RemediationChanges;

    expect(normalizeRemediationChanges(remediation)).toEqual({
      upgrade: remediation.upgrade,
      pin: {},
      patch: {},
      ignore: {},
      unresolved: [],
    });
  });

  it('leaves complete remediation objects unchanged', () => {
    const remediation: RemediationChanges = {
      upgrade: {},
      pin: {},
      patch: { 'SNYK-123': { paths: [] } as any },
      ignore: { 'SNYK-123': [] },
      unresolved: [{ id: 'SNYK-123' } as any],
    };

    expect(normalizeRemediationChanges(remediation)).toEqual(remediation);
  });
});

describe('convertTestDepGraphResultToLegacy remediation normalization', () => {
  it('adds an empty patch object when the dep graph response omits patch', async () => {
    const response = cloneDeep(
      JSON.parse(
        fs.readFileSync(
          getFixturePath('npm/with-vulnerable-lodash-dep/test-dep-graph-result.json'),
          'utf8',
        ),
      ),
    ) as TestDepGraphResponse;

    delete (response.result.remediation as Partial<RemediationChanges>).patch;

    const legacyResult = await convertTestDepGraphResultToLegacy(
      response,
      lodashProjectDepGraph(),
      'npm',
      {} as Options & TestOptions,
    );

    expect(legacyResult.remediation?.patch).toEqual({});
    expect(legacyResult.remediation).toMatchObject({
      upgrade: response.result.remediation?.upgrade,
      pin: response.result.remediation?.pin,
      ignore: response.result.remediation?.ignore,
      unresolved: response.result.remediation?.unresolved,
    });
  });
});

describe('downstream remediation consumers', () => {
  it('serializes patch as an empty object in json test output', () => {
    const mappedResult = {
      ok: false,
      vulnerabilities: [],
      remediation: normalizeRemediationChanges(
        remediationMissingPatchSubField(),
      ),
    };

    const { stringifiedJsonData } = extractDataToSendFromResults(
      [mappedResult],
      [mappedResult],
      { json: true } as Options,
    );

    const jsonOutput = JSON.parse(stringifiedJsonData);
    expect(jsonOutput.remediation.patch).toEqual({});
    expect(jsonOutput.remediation).toMatchObject({
      upgrade: {},
      pin: {},
      ignore: {},
      unresolved: [],
    });
  });

  it('formats actionable remediation without error when patch was omitted', () => {
    expect(() =>
      formatIssuesWithRemediation(
        [],
        normalizeRemediationChanges(remediationMissingPatchSubField())!,
        { showVulnPaths: 'some' } as TestOptions,
      ),
    ).not.toThrow();
  });
});
