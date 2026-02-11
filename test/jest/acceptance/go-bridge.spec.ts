import { execGoCommand, GoCommandResult } from '../../../src/lib/go-bridge';
import { getCliBinaryPath } from '../util/getCliBinaryPath';
import { testIf } from '../../utils';

const hasBinary = !!process.env.TEST_SNYK_COMMAND;

describe('go-bridge (acceptance)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    if (hasBinary) {
      process.env.SNYK_CLI_EXECUTABLE_PATH = getCliBinaryPath();
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  testIf(hasBinary)(
    'execGoCommand can call the real binary with "version"',
    async () => {
      const result: GoCommandResult = await execGoCommand(['version']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    },
    20_000,
  );

  testIf(hasBinary)(
    'execGoCommand returns non-zero exit code for unknown subcommand',
    async () => {
      const result: GoCommandResult = await execGoCommand([
        'this-command-does-not-exist',
      ]);
      expect(result.exitCode).not.toBe(0);
    },
    20_000,
  );
});
