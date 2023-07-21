import * as os from 'os';
import { startSnykCLI, TestCLI } from '../../util/startSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk container', () => {
  if (os.platform() === 'win32') {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping as we don't have a Windows-compatible image to test against.",
      );
    });
  }

  let cli: TestCLI | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.stop();
      cli = null;
    }
  });

  it('finds dependencies in rpm sqlite databases', async () => {
    cli = await startSnykCLI(
      'container test amazonlinux:2022.0.20220504.1 --print-deps',
    );
    await expect(cli).toDisplay(`yum @ 4.9.0`, { timeout: 60 * 1000 });
  });

  it('finds dependencies in oci image (library/ubuntu)', async () => {
    cli = await startSnykCLI(
      'container test library/ubuntu@sha256:7a57c69fe1e9d5b97c5fe649849e79f2cfc3bf11d10bbd5218b4eb61716aebe6 --print-deps',
    );
    await expect(cli).toDisplay(`coreutils @ 8.32-4.1ubuntu1`, {
      timeout: 60 * 1000,
    });
  });
});
