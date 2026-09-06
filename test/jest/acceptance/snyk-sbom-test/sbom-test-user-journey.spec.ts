import { existsSync } from 'fs';

import { runSnykCLI } from '../../util/runSnykCLI';
import { getFixturePath } from '../../util/getFixturePath';

jest.setTimeout(1000 * 300);

const SBOM_FILE_PATH = getFixturePath('sbom/snyk-goof-sbom.json');

const VARIANTS = [
  { reportFlag: '--report', assetName: 'cli-sbom-test-report-user-journey' },
  { reportFlag: '--monitor', assetName: 'cli-sbom-test-monitor-user-journey' },
];

const LOG_TAG = '[sbom-monitor-user-journey]';

const dragonflyEnv = {
  ...process.env,
  SNYK_API: process.env.TEST_SNYK_API_DEV,
  SNYK_TOKEN: process.env.TEST_SNYK_TOKEN_DEV,
  INTERNAL_SNYK_CLI_ROLLOUT_DFLY_SBOM_MONITOR: 'true',
};

const describeIfPreProd = process.env.TEST_SNYK_TOKEN_DEV
  ? describe
  : describe.skip;

beforeAll(() => {
  if (!existsSync(SBOM_FILE_PATH)) {
    throw new Error(
      `SBOM fixture not found at ${SBOM_FILE_PATH}. Please ensure test fixtures are properly set up.`,
    );
  }
});

describeIfPreProd.each(VARIANTS)(
  'snyk sbom test $reportFlag',
  ({ reportFlag, assetName }) => {
    const logTag = `${LOG_TAG}[${reportFlag}]`;

    it('should successfully test an SBOM', async () => {
      const command = `sbom test ${reportFlag} --file=${SBOM_FILE_PATH} --asset-name=${assetName}`;
      console.log(`${logTag} running: snyk ${command}`);

      const { code, stdout, stderr } = await runSnykCLI(command, {
        env: dragonflyEnv,
      });

      console.log(`${logTag} exit code: ${code}`);
      console.log(`${logTag} stdout:\n${stdout}`);
      console.log(`${logTag} stderr:\n${stderr}`);

      expect(stdout).toContain('View your asset(s) at:');
      expect(code).toBe(1);
    });
  },
);
