import { DepGraphData } from '@snyk/dep-graph';
import { hasFixableIssues } from '../../../../src/lib/issues/fixable-issues';

describe('hasFixableIssues', () => {
  it('has patchable', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {
            'npm:node-uuid:20160328': {
              paths: [
                {
                  ms: {
                    patched: '2019-11-29T15:08:55.159Z',
                  },
                },
              ],
            },
          },
          pin: {},
          unresolved: [],
          upgrade: {},
        },
      },
    ];
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 1,
      hasFixes: true,
    });
  });

  it('has upgrades', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {},
          pin: {},
          unresolved: [],
          upgrade: {
            'qs@0.0.6': {
              upgradeTo: 'qs@6.0.4',
              upgrades: ['qs@0.0.6', 'qs@0.0.6', 'qs@0.0.6'],
              vulns: [
                'npm:qs:20170213',
                'npm:qs:20140806',
                'npm:qs:20140806-1',
              ],
            },
          },
        },
      },
    ];
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 3,
      hasFixes: true,
    });
  });

  it('has pins', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {},
          upgrade: {},
          unresolved: [],
          pin: {
            'qs@0.0.6': {
              upgradeTo: 'qs@6.0.4',
              upgrades: ['qs@0.0.6', 'qs@0.0.6', 'qs@0.0.6'],
              vulns: [
                'npm:qs:20170213',
                'npm:qs:20140806',
                'npm:qs:20140806-1',
              ],
              isTransitive: true,
            },
          },
        },
      },
    ];
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 3,
      hasFixes: true,
    });
  });
  it('has upgrades, patchable', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {
            'npm:node-uuid:20160328': {
              paths: [
                {
                  ms: {
                    patched: '2019-11-29T15:08:55.159Z',
                  },
                },
              ],
            },
          },
          upgrade: {
            'qs@0.0.6': {
              upgradeTo: 'qs@6.0.4',
              upgrades: ['qs@0.0.6', 'qs@0.0.6', 'qs@0.0.6'],
              vulns: [
                'npm:qs:20170213',
                'npm:qs:20140806',
                'npm:qs:20140806-1',
              ],
              isTransitive: true,
            },
          },
          unresolved: [],
          pin: {},
        },
      },
    ];
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 4,
      hasFixes: true,
    });
  });

  it('multiple issues with fixes', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {},
          upgrade: {},
          unresolved: [],
          pin: {
            'qs@0.0.6': {
              upgradeTo: 'qs@6.0.4',
              upgrades: ['qs@0.0.6', 'qs@0.0.6', 'qs@0.0.6'],
              vulns: [
                'npm:qs:20170213',
                'npm:qs:20140806',
                'npm:qs:20140806-1',
              ],
              isTransitive: true,
            },
          },
        },
      },
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {},
          pin: {},
          unresolved: [],
          upgrade: {
            'qs@0.0.6': {
              upgradeTo: 'qs@6.0.4',
              upgrades: ['qs@0.0.6', 'qs@0.0.6', 'qs@0.0.6'],
              vulns: [
                'npm:qs:20170213',
                'npm:qs:20140806',
                'npm:qs:20140806-1',
              ],
              isTransitive: true,
            },
          },
        },
      },
    ] as any; // TODO: ts not happy about this for some reason
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 6,
      hasFixes: true,
    });
  });

  it('has no fixable', async () => {
    const testResults = [
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
      },
      {
        issues: [],
        issuesData: {},
        depGraphData: {} as unknown as DepGraphData,
        remediation: {
          ignore: {},
          patch: {},
          upgrade: {},
          unresolved: [],
          pin: {},
        },
      },
    ];
    const res = await hasFixableIssues(testResults);
    expect(res).toEqual({
      count: 0,
      hasFixes: false,
    });
  });
});
