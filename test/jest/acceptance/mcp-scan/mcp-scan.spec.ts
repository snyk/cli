import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60 * 5);

describe('agent-scan command', () => {
  it.each([
    { platform: 'darwin', arch: 'arm64' },
    { platform: 'darwin', arch: 'x64' },
    // TODO: testing on linux is not supported yet [MCP-914]
    // { platform: 'linux', arch: 'x64' }
    { platform: 'win32', arch: 'x64' },
  ])(
    'invokes agent-scan and prints invariant version text on $platform $arch',
    async ({ platform, arch }) => {
      // Skip if not running on the current platform
      if (process.platform !== platform) {
        return;
      }

      // Skip if architecture is specified but doesn't match
      if (arch && process.arch !== arch) {
        return;
      }

      const { stdout, stderr } = await runSnykCLI(
        'agent-scan --experimental --client-id=6e31e1ce-1d84-45c4-b0e3-d63008548dbb',
        {
          env: {
            ...process.env,
            SNYK_DISABLE_ANALYTICS: '1',
          },
          logErrors: true,
        },
      );

      const output = `${stdout}\n${stderr}`;
      expect(output).toContain('Snyk Agent Scan v');
    },
  );
});
