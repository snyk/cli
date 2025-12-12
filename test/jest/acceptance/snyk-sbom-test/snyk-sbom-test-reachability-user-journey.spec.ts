import { execSync } from 'child_process';
import { existsSync } from 'fs';

import { matchers } from 'jest-json-schema';
import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { getFixturePath } from '../../util/getFixturePath';

expect.extend(matchers);
jest.setTimeout(1000 * 120);

const TEST_REPO_URL = 'https://github.com/snyk/snyk-goof.git';
const TEMP_LOCAL_PATH = '/tmp/snyk-goof-reachability-test';
const SBOM_FILE_PATH = getFixturePath('sbom/snyk-goof-sbom.json');

const reachabilityEnv = {
  ...process.env,
  INTERNAL_SNYK_CLI_REACHABILITY_ENABLED: 'true',
  INTERNAL_SNYK_CLI_SBOM_TEST_REACHABILITY: 'true',
};

beforeAll(() => {
  if (!existsSync(SBOM_FILE_PATH)) {
    throw new Error(
      `SBOM fixture not found at ${SBOM_FILE_PATH}. Please ensure test fixtures are properly set up.`,
    );
  }

  if (!existsSync(TEMP_LOCAL_PATH)) {
    try {
      execSync(`git clone --depth 1 ${TEST_REPO_URL} ${TEMP_LOCAL_PATH}`, {
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (error) {
      throw new Error(
        `Failed to clone test repository: ${error.message}. This test requires network access.`,
      );
    }
  }
});

afterAll(() => {
  if (existsSync(TEMP_LOCAL_PATH)) {
    try {
      execSync(`rm -rf ${TEMP_LOCAL_PATH}`, { stdio: 'pipe' });
    } catch (err) {
      console.warn('Failed to cleanup test repository:', err.message);
    }
  }
});

describe('snyk sbom test --reachability', () => {
  it('should display human-readable output with test summary', async () => {
    const { code, stdout, stderr } = await runSnykCLI(
      `sbom test --experimental --file=${SBOM_FILE_PATH} --reachability --source-dir=${TEMP_LOCAL_PATH}`,
      { env: reachabilityEnv },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('Test Summary');
    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });

  it('should output valid JSON with reachability data', async () => {
    const { code, stdout, stderr } = await runSnykCLI(
      `sbom test --experimental --file=${SBOM_FILE_PATH} --reachability --source-dir=${TEMP_LOCAL_PATH} --json`,
      { env: reachabilityEnv },
    );

    expect(stderr).toBe('');
    expect(stdout).not.toBe('');

    const jsonOutput = JSON.parse(stdout);

    expect(jsonOutput.dependencyCount).toBeGreaterThan(0);
    expect(jsonOutput.vulnerabilities).toBeInstanceOf(Array);
    expect(jsonOutput.vulnerabilities.length).toBeGreaterThanOrEqual(1);

    const vulnsWithReachability = jsonOutput.vulnerabilities.filter(
      (vuln: any) => vuln.reachability !== undefined,
    );
    expect(vulnsWithReachability.length).toBeGreaterThan(0);

    const reachableVulns = jsonOutput.vulnerabilities.filter(
      (vuln: any) => vuln.reachability === 'reachable',
    );

    expect(reachableVulns.length).toBeGreaterThan(0);

    expect(reachableVulns[0]).toHaveProperty('id');
    expect(reachableVulns[0]).toHaveProperty('title');
    expect(reachableVulns[0]).toHaveProperty('severity');
    expect(reachableVulns[0]).toHaveProperty('reachability', 'reachable');

    expect(code).toBe(EXIT_CODES.VULNS_FOUND);
  });
});
