import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';

import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { join } from 'path';

jest.setTimeout(1000 * 180);

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
  'npm:http-signature:20150122':
    - '*':
        reason: This license is addressed by including acknowledgments in each release
`;

  writeFileSync(`${path}/.snyk`, localPolicy, { encoding: 'utf8' });
}

type IntegrationEnv = {
  env: Record<string, string | undefined>;
};

const ReachabilityIntegrationEnv: IntegrationEnv = {
  env: {
    INTERNAL_SNYK_CLI_REACHABILITY_ENABLED: 'true',
    INTERNAL_SNYK_CLI_EXPERIMENTAL_RISK_SCORE: 'true',
    INTERNAL_SNYK_CLI_EXPERIMENTAL_RISK_SCORE_IN_CLI: 'true',
  },
};

describe('snyk test --reachability', () => {
  test('runs in the requested path and emits human readable output', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test --reachability ${TEMP_LOCAL_PATH}`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    expect(stdout).toContain('Test Summary');
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('runs in the requested path with configured local policy .snyk', async () => {
    injectLocalPolicy(TEMP_LOCAL_PATH);
    const { stdout, code, stderr } = await runSnykCLI(
      `test --reachability ${TEMP_LOCAL_PATH}`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    expect(stdout).toContain('Ignored: 1');
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('runs in the requested path with configured local policy .snyk but ignores the policy if --ignore-policy is enabled', async () => {
    injectLocalPolicy(TEMP_LOCAL_PATH);
    const { stdout, code, stderr } = await runSnykCLI(
      `test --reachability --ignore-policy ${TEMP_LOCAL_PATH}`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    expect(stdout).toContain('Ignored: 0');
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('emits a valid json output with filtering only reachable vulnerabilities', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --reachability-filter=reachable --json`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const jsonOutput = JSON.parse(stdout);

    const areAllVulnsReachable = jsonOutput.vulnerabilities.every(
      (vuln: { reachability: string }) => vuln.reachability === 'reachable',
    );

    expect(jsonOutput.vulnerabilities.length).toBeGreaterThanOrEqual(1);
    expect(areAllVulnsReachable).toBeTruthy();

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('emits a valid json output and fails the test if vulnerabilies are upgradable', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --fail-on=upgradable --json`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const jsonOutput = JSON.parse(stdout);

    const includesUpgradablePaths = jsonOutput.vulnerabilities.some(
      (vuln: { isUpgradable: boolean }) => vuln.isUpgradable,
    );

    expect(includesUpgradablePaths).toBeTruthy();

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('only uploads the requested source code dir and emits a valid json output with', async () => {
    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --source-dir=${TEMP_LOCAL_PATH}/routes --json`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.dependencyCount).toBeGreaterThan(0);
    expect(jsonOutput.ok).toBeFalsy();

    const momentVuln = jsonOutput.vulnerabilities.find(
      (v) => v.id === 'npm:moment:20161019',
    );
    expect(momentVuln.alternativeIds).toEqual(['SNYK-JS-MOMENT-10164']);
    expect(momentVuln.proprietary).toEqual(true);
    expect(momentVuln.isDisputed).toEqual(false);
    expect(momentVuln.severityBasedOn).toEqual('CVSS');

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('works with --sarif', async () => {
    const { stdout, code } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --sarif`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');

    const sarifOutputJson = JSON.parse(stdout);
    expect(sarifOutputJson['$schema']).toBeDefined();
    expect(sarifOutputJson.runs[0].results.length).toBeGreaterThanOrEqual(1);

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('works with --json and --sarif-file-output', async () => {
    const tmppath = tmpdir();
    const sarifOutputPath = join(tmppath, 'test.sarif');

    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --json --sarif-file-output=${sarifOutputPath}`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stdout).not.toBe('');
    expect(stderr).toBe('');

    const jsonOutput = JSON.parse(stdout);
    expect(jsonOutput.vulnerabilities.length).toBeGreaterThanOrEqual(1);

    const sarifOutputJson = JSON.parse(readFileSync(sarifOutputPath, 'utf8'));
    expect(sarifOutputJson['$schema']).toBeDefined();
    expect(sarifOutputJson.runs[0].results.length).toBeGreaterThanOrEqual(1);

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  test('works with --json-file-output and --sarif-file-output', async () => {
    const tmppath = tmpdir();
    const jsonOutputPath = join(tmppath, 'test2.json');
    const sarifOutputPath = join(tmppath, 'test2.sarif');

    const { stdout, code, stderr } = await runSnykCLI(
      `test ${TEMP_LOCAL_PATH} --reachability --json-file-output=${jsonOutputPath} --sarif-file-output=${sarifOutputPath}`,
      {
        env: {
          ...process.env,
          ...ReachabilityIntegrationEnv.env,
        },
      },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('Test Summary');

    const jsonOutput = JSON.parse(readFileSync(jsonOutputPath, 'utf8'));
    expect(jsonOutput.vulnerabilities.length).toBeGreaterThanOrEqual(1);

    const sarifOutputJson = JSON.parse(readFileSync(sarifOutputPath, 'utf8'));
    expect(sarifOutputJson['$schema']).toBeDefined();
    expect(sarifOutputJson.runs[0].results.length).toBeGreaterThanOrEqual(1);

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });
});
