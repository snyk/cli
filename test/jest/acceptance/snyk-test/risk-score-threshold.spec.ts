import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';

jest.setTimeout(1000 * 120);

const TEST_REPO_URL = 'https://github.com/snyk/snyk-goof.git';
const TEMP_LOCAL_PATH = '/tmp/snyk-goof';

beforeAll(() => {
  if (!existsSync(TEMP_LOCAL_PATH)) {
    execSync(
      `git clone ${TEST_REPO_URL} ${TEMP_LOCAL_PATH} && cd ${TEMP_LOCAL_PATH} && npm install --ignore-scripts`,
      {
        stdio: 'inherit',
      },
    );
  }
});

function injectLocalPolicy(path: string) {
  const localPolicy = `
version: v1.25.1
ignore:
  'snyk:lic:npm:symbol:MPL-2.0':
    - '*':
        reason: This license is addressed by including acknowledgments in each release
`;

  writeFileSync(`${path}/.snyk`, localPolicy, { encoding: 'utf8' });
}

type IntegrationEnv = {
  env: Record<string, string | undefined>;
};

const RiskScoreIntegrationEnv: IntegrationEnv = {
  env: {
    INTERNAL_SNYK_CLI_EXPERIMENTAL_RISK_SCORE: 'true',
    INTERNAL_SNYK_CLI_EXPERIMENTAL_RISK_SCORE_IN_CLI: 'true',
  },
};

const RISK_SCORE_THRESHOLD = 400;

describe('snyk test --risk-score-threshold', () => {
  const testEnv: Record<string, string | undefined> = {
    ...process.env,
    ...RiskScoreIntegrationEnv.env,
  };

  test('filters findings by risk score threshold (human-readable output) and displays Risk Score for each finding', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --risk-score-threshold=${RISK_SCORE_THRESHOLD}`,
      {
        env: testEnv,
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const riskScoreRegex = /Risk Score:\s*(\d+)/gi;
    const riskScoreMatches = [...stdout.matchAll(riskScoreRegex)];
    const riskScores = riskScoreMatches.map((match) => parseInt(match[1], 10));

    expect(stdout).toContain('Test Summary');
    expect(riskScores.length).toBeGreaterThanOrEqual(1);
    expect(
      riskScores.every((score) => score >= RISK_SCORE_THRESHOLD),
    ).toBeTruthy();

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('filters findings by risk score threshold (JSON output) and displays only findings with riskScore >= threshold', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --risk-score-threshold=${RISK_SCORE_THRESHOLD} --json`,
      {
        env: testEnv,
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const jsonOutput = JSON.parse(stdout);
    const result = Array.isArray(jsonOutput) ? jsonOutput[0] : jsonOutput;

    expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(1);

    const vulnerabilitiesWithRiskScore = result.vulnerabilities.filter(
      (vuln: { riskScore?: number }) => vuln.riskScore !== undefined,
    );

    expect(vulnerabilitiesWithRiskScore.length).toBeGreaterThanOrEqual(1);

    vulnerabilitiesWithRiskScore.forEach((vuln: { riskScore: number }) => {
      expect(vuln.riskScore).toBeGreaterThanOrEqual(RISK_SCORE_THRESHOLD);
    });

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('runs in the requested path with risk-score-threshold and .snyk local policy', async () => {
    injectLocalPolicy(TEMP_LOCAL_PATH);
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --risk-score-threshold=${RISK_SCORE_THRESHOLD}`,
      {
        env: testEnv,
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    expect(stdout).toMatch(/Total security issues:.*\n.*Ignored: 0/);
    expect(stdout).toMatch(/Total license issues:.*\n.*Ignored: 1/);
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('runs in the requested path with risk-score-threshold and .snyk local policy but ignores policy if --ignore-policy is enabled', async () => {
    injectLocalPolicy(TEMP_LOCAL_PATH);
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --risk-score-threshold=${RISK_SCORE_THRESHOLD} --ignore-policy`,
      {
        env: testEnv,
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');
    expect(stdout).toMatch(/Total security issues:.*\n.*Ignored: 0/);
    expect(stdout).toMatch(/Total license issues:.*\n.*Ignored: 0/);
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });
});
