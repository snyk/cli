import { runSnykCLI } from '../../util/runSnykCLI';
import { isWindowsOperatingSystem, testIf } from '../../../utils';

jest.setTimeout(1000 * 60 * 5);

describe('mcp-scan command', () => {
  testIf(!isWindowsOperatingSystem() && process.platform !== 'linux')(
    'invokes mcp-scan and prints invariant version text',
    async () => {
      const { stdout, stderr } = await runSnykCLI(
        'mcp-scan --experimental --client-id=6e31e1ce-1d84-45c4-b0e3-d63008548dbb',
        {
          env: {
            ...process.env,
            SNYK_DISABLE_ANALYTICS: '1',
          },
          logErrors: true,
        },
      );

      const output = `${stdout}\n${stderr}`;
      expect(output).toContain('Invariant MCP-scan v');
    },
  );
});
