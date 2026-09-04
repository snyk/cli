import { writeFileSync } from 'fs';
import { join } from 'path';

import { runSnykCLI } from '../../util/runSnykCLI';
import { EXIT_CODES } from '../../../../src/cli/exit-codes';
import { makeTmpDirectory } from '../../../utils';

jest.setTimeout(1000 * 300);

type Route = {
  name: string;
  env: Record<string, string>;
};

const routes: Route[] = [
  {
    name: 'legacy',
    env: { SNYK_FORCE_LEGACY_CLI: 'true' },
  },
  {
    name: 'unified test API',
    env: { INTERNAL_SNYK_CLI_USE_UNIFIED_TEST_API_FOR_OS_CLI_TEST: 'true' },
  },
];

describe('snyk test on a directory with no supported target files', () => {
  let projectPath: string;

  beforeAll(async () => {
    projectPath = await makeTmpDirectory();
    writeFileSync(join(projectPath, 'README.md'), '# no manifests here\n');
  });

  describe.each(routes)('$name', ({ env: routeEnv }) => {
    const env = { ...process.env, ...routeEnv };

    test('reports SNYK-CLI-0008 and exits with NO_SUPPORTED_PROJECTS_DETECTED', async () => {
      const { code, stdout } = await runSnykCLI(`test ${projectPath}`, { env });

      expect(stdout).toContain('SNYK-CLI-0008');
      expect(stdout).toContain('No supported files found');
      expect(code).toBe(EXIT_CODES.NO_SUPPORTED_PROJECTS_DETECTED);
    });

    test('writes the --json error document to stdout', async () => {
      const { code, stdout } = await runSnykCLI(`test ${projectPath} --json`, {
        env,
      });

      expect(JSON.parse(stdout)).toEqual(
        expect.objectContaining({
          ok: false,
          error: expect.stringContaining(
            'Could not detect supported target files in',
          ),
        }),
      );
      expect(code).toBe(EXIT_CODES.NO_SUPPORTED_PROJECTS_DETECTED);
    });
  });
});
