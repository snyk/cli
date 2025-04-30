import * as mockFs from 'mock-fs';

import {
  driftignoreFromPolicy,
  parseDriftAnalysisResults,
  updateExcludeInPolicy,
} from '../../../../../../src/lib/iac/drift';
import envPaths from 'env-paths';
import { EXIT_CODES } from '../../../../../../src/cli/exit-codes';
import * as fs from 'fs';
import * as path from 'path';
import {
  DescribeOptions,
  DriftAnalysis,
  GenDriftIgnoreOptions,
} from '../../../../../../src/lib/iac/types';
import { addIacDriftAnalytics } from '../../../../../../src/cli/commands/test/iac/local-execution/analytics';
import * as analytics from '../../../../../../src/lib/analytics';
import * as snykPolicy from 'snyk-policy';
import { Policy } from 'snyk-policy';
import {
  DCTL_EXIT_CODES,
  driftctlVersion,
  generateArgs,
  translateExitCode,
} from '../../../../../../src/lib/iac/drift/driftctl';
import { getHumanReadableAnalysis } from '../../../../../../src/lib/iac/drift/output';

const paths = envPaths('snyk');

describe('driftctl integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockFs.restore();
  });

  it('describe: default arguments are correct', async () => {
    const args = await generateArgs({ kind: 'describe' }, []);
    expect(args).toEqual([
      'scan',
      '--no-version-check',
      '--output',
      'json://stdout',
      '--config-dir',
      paths.cache,
      '--to',
      'aws+tf',
    ]);
  });

  it('describe: passing options generate correct arguments', async () => {
    const args = await generateArgs(
      {
        kind: 'describe',
        'config-dir': 'confdir',
        'tf-lockfile': 'tflockfile',
        'tf-provider-version': 'tfproviderversion',
        'tfc-endpoint': 'tfcendpoint',
        'tfc-token': 'tfctoken',
        driftignore: 'driftignore',
        filter: 'filter',
        from: 'from',
        'fetch-tfstate-headers': 'headers',
        quiet: true,
        strict: true,
        to: 'to',
      } as DescribeOptions,
      ['*', '!aws_s3_bucket'],
    );
    expect(args).toEqual([
      'scan',
      '--no-version-check',
      '--quiet',
      '--filter',
      'filter',
      '--output',
      'json://stdout',
      '--headers',
      'headers',
      '--tfc-token',
      'tfctoken',
      '--tfc-endpoint',
      'tfcendpoint',
      '--tf-provider-version',
      'tfproviderversion',
      '--strict',
      '--driftignore',
      'driftignore',
      '--tf-lockfile',
      'tflockfile',
      '--ignore',
      '*,!aws_s3_bucket',
      '--config-dir',
      'confdir',
      '--from',
      'from',
      '--to',
      'to',
    ]);
  });

  it('describe: from arguments is a coma separated list', async () => {
    const args = await generateArgs({
      kind: 'describe',
      from: 'path1,path2,path3',
    } as DescribeOptions);
    expect(args).toEqual([
      'scan',
      '--no-version-check',
      '--output',
      'json://stdout',
      '--config-dir',
      paths.cache,
      '--from',
      'path1',
      '--from',
      'path2',
      '--from',
      'path3',
      '--to',
      'aws+tf',
    ]);
  });

  it('run driftctl: exit code is translated', () => {
    expect(translateExitCode(DCTL_EXIT_CODES.EXIT_IN_SYNC)).toEqual(0);
    expect(translateExitCode(DCTL_EXIT_CODES.EXIT_NOT_IN_SYNC)).toEqual(
      EXIT_CODES.VULNS_FOUND,
    );
    expect(translateExitCode(DCTL_EXIT_CODES.EXIT_ERROR)).toEqual(
      EXIT_CODES.ERROR,
    );
    expect(translateExitCode(42)).toEqual(EXIT_CODES.ERROR);
  });
});

// That test mostly cover the Types definition
// There is no really any custom logic in that method
describe('parseDriftAnalysisResults', () => {
  it('should parse correctly drift analysis', () => {
    const driftAnalysisFile = fs.readFileSync(
      path.resolve(__dirname, `fixtures/driftctl-analysis.json`),
    );
    const analysis = parseDriftAnalysisResults(driftAnalysisFile.toString());
    const expected: DriftAnalysis = {
      coverage: 33,
      alerts: {
        aws_iam_access_key: [
          {
            message: 'This is an alert',
          },
        ],
      },
      missing: [
        {
          id: 'test-driftctl2',
          type: 'aws_iam_user',
        },
        {
          id: 'AAAAAAAAAAAAAAAAAAAA',
          type: 'aws_iam_access_key',
        },
      ],
      managed: [
        {
          id: 'AKIA5QYBVVD25KFXJHYJ',
          type: 'aws_iam_access_key',
        },
        {
          id: 'test-managed',
          type: 'aws_iam_user',
        },
      ],
      provider_name: 'AWS',
      provider_version: '2.18.5',
      scan_duration: 123,
      summary: {
        total_missing: 2,
        total_iac_source_count: 3,
        total_managed: 2,
        total_resources: 6,
        total_unmanaged: 2,
      },
      unmanaged: [
        {
          id: 'driftctl',
          type: 'aws_s3_bucket_policy',
        },
        {
          id: 'driftctl',
          type: 'aws_s3_bucket_notification',
        },
      ],
    };
    expect(analysis).toEqual(expected);
  });
});

describe('drift analytics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('should add most of all drift analytics depending on a given analysis', () => {
    const addAnalyticsSpy = jest.spyOn(analytics, 'add');
    const options: DescribeOptions = { kind: 'describe' };
    const driftAnalysisFile = fs.readFileSync(
      path.resolve(__dirname, `fixtures/driftctl-analysis.json`),
    );
    const analysis = parseDriftAnalysisResults(driftAnalysisFile.toString());
    addIacDriftAnalytics(analysis, options);

    expect(addAnalyticsSpy).toHaveBeenCalledTimes(11);
    expect(addAnalyticsSpy).toHaveBeenCalledWith('iac-drift-coverage', 33);
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-total-resources',
      6,
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-total-unmanaged',
      2,
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith('iac-drift-total-managed', 2);
    expect(addAnalyticsSpy).toHaveBeenCalledWith('iac-drift-total-missing', 2);
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-iac-source-count',
      3,
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-provider-name',
      'AWS',
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-provider-version',
      '2.18.5',
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-version',
      driftctlVersion,
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith(
      'iac-drift-scan-duration',
      123,
    );
    expect(addAnalyticsSpy).toHaveBeenCalledWith('iac-drift-scan-scope', 'all');
  });
});

const loadPolicyFixture = async (name: string): Promise<Policy> => {
  const policyPath = path.join(__dirname, 'fixtures', name);
  const policyText = fs.readFileSync(policyPath, 'utf-8');
  return await snykPolicy.loadFromText(policyText);
};

describe('driftignoreFromPolicy', () => {
  it.each([
    ['policy undefined', undefined, []],
    [
      'policy with no excludes',
      loadPolicyFixture('policy-no-excludes.yml'),
      [],
    ],
    [
      'policy with irrelevant excludes',
      loadPolicyFixture('policy-irrelevant-excludes.yml'),
      [],
    ],
    [
      'policy with empty drift excludes',
      loadPolicyFixture('policy-empty-drift-excludes.yml'),
      [],
    ],
    [
      'policy with one drift exclude',
      loadPolicyFixture('policy-one-drift-exclude.yml'),
      ['foo'],
    ],
    [
      'policy with several drift excludes',
      loadPolicyFixture('policy-several-drift-excludes.yml'),
      ['*', '!aws_iam_*', 'aws_s3_*', 'aws_s3_bucket.*', 'aws_s3_bucket.name*'],
    ],
  ])('%s', async (_, policy, expected) => {
    expect(driftignoreFromPolicy(await policy)).toEqual(expected);
  });
});

describe('updateExcludeInPolicy', () => {
  const analysis = parseDriftAnalysisResults(
    fs.readFileSync(
      path.join(__dirname, 'fixtures', 'driftctl-analysis.json'),
      'utf-8',
    ),
  );
  it.each([
    [
      'policy with no excludes',
      'policy-no-excludes.yml',
      {},
      {
        code: [],
        global: [],
        'iac-drift': [
          'aws_iam_user.test-driftctl2',
          'aws_iam_access_key.AAAAAAAAAAAAAAAAAAAA',
          'aws_s3_bucket_policy.driftctl',
          'aws_s3_bucket_notification.driftctl',
        ],
      },
    ],
    [
      'policy with irrelevant excludes',
      'policy-irrelevant-excludes.yml',
      {},
      {
        foo: ['bar'],
        'iac-drift': [
          'aws_iam_user.test-driftctl2',
          'aws_iam_access_key.AAAAAAAAAAAAAAAAAAAA',
          'aws_s3_bucket_policy.driftctl',
          'aws_s3_bucket_notification.driftctl',
        ],
      },
    ],
    [
      'policy with empty drift excludes',
      'policy-empty-drift-excludes.yml',
      {},
      {
        'iac-drift': [
          'aws_iam_user.test-driftctl2',
          'aws_iam_access_key.AAAAAAAAAAAAAAAAAAAA',
          'aws_s3_bucket_policy.driftctl',
          'aws_s3_bucket_notification.driftctl',
        ],
      },
    ],
    [
      'policy with several drift excludes',
      'policy-several-drift-excludes.yml',
      {},
      {
        'iac-drift': [
          // Those are existing ones
          '*',
          '!aws_iam_*',
          'aws_s3_*',
          'aws_s3_bucket.*',
          'aws_s3_bucket.name*',
          // Following exclude are the new ones
          'aws_iam_user.test-driftctl2',
          'aws_iam_access_key.AAAAAAAAAAAAAAAAAAAA',
          'aws_s3_bucket_policy.driftctl',
          'aws_s3_bucket_notification.driftctl',
        ],
      },
    ],
    [
      'with exclude changed option',
      'policy-no-excludes.yml',
      {
        'exclude-missing': true,
      },
      {
        code: [],
        global: [],
        'iac-drift': [
          'aws_s3_bucket_policy.driftctl',
          'aws_s3_bucket_notification.driftctl',
        ],
      },
    ],
    [
      'with exclude changed option',
      'policy-no-excludes.yml',
      {
        'exclude-unmanaged': true,
      },
      {
        code: [],
        global: [],
        'iac-drift': [
          'aws_iam_user.test-driftctl2',
          'aws_iam_access_key.AAAAAAAAAAAAAAAAAAAA',
        ],
      },
    ],
  ])('%s', async (_, policyPath, options: GenDriftIgnoreOptions, expected) => {
    const policy = await loadPolicyFixture(policyPath);
    updateExcludeInPolicy(policy, analysis, options);
    expect(policy.exclude).toEqual(expected);
  });
});

describe('Test describe output', () => {
  const loadFile = (name: string): string => {
    const filePath = path.join(__dirname, 'fixtures', name);
    return fs.readFileSync(filePath, 'utf-8');
  };

  it('test output for known analysis', () => {
    const analysis = JSON.parse(loadFile('all.json'));
    const options: DescribeOptions = {
      kind: 'describe',
    };
    const hrAnalysis = getHumanReadableAnalysis(options, analysis);

    const expectedOutput = loadFile('all.console');
    expect(hrAnalysis).toBe(expectedOutput);
  });
});
