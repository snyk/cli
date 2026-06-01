import { existsSync } from 'fs';

import { runSnykCLI } from '../../util/runSnykCLI';
import { getFixturePath } from '../../util/getFixturePath';

jest.setTimeout(1000 * 300);

const SBOM_FILE_PATH = getFixturePath('sbom/snyk-goof-sbom.json');

const dragonflyEnv = {
  ...process.env,
  INTERNAL_SNYK_CLI_ROLLOUT_DFLY_SBOM_MONITOR: 'true',
};

beforeAll(() => {
  if (!existsSync(SBOM_FILE_PATH)) {
    throw new Error(
      `SBOM fixture not found at ${SBOM_FILE_PATH}. Please ensure test fixtures are properly set up.`,
    );
  }
});

describe('snyk sbom monitor', () => {
    it('should successfully monitor an SBOM', async () => {
      const { code, stdout, stderr } = await runSnykCLI(
        `sbom monitor --experimental --file=${SBOM_FILE_PATH}`,
        { env: dragonflyEnv },
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Monitoring');
      expect(code).toBe(0);
    });
});
