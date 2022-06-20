import * as pathLib from 'path';
import { startMockServer } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50_000);

describe('iac --experimental', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    env?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  const cliUnifiedEngineFeatureFlag = 'iacCliUnifiedEngine';

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  describe(`"${cliUnifiedEngineFeatureFlag}" feature flag is ON`, () => {
    beforeEach(() => {
      server.setFeatureFlag(cliUnifiedEngineFeatureFlag, true);
      server.setFeatureFlag('iacCliOutputRelease', true);
    });

    describe('with the --experimental flag', () => {
      it('diverts to the new flow', async () => {
        const { exitCode, stdout } = await run(
          `snyk iac test ./iac/arm/rule_test.json --experimental`,
        );
        expect(stdout).not.toContain('Snyk Infrastructure as Code');
        expect(stdout).not.toContain('Issues');

        // TODO the command currently doesn't download the engine in case it's
        // missing, and it causes the command to fail with a non-zero exit code.
        // This should be fixed as soon as we are able to download the engine.

        expect(exitCode).toBe(2);
      });

      describe('when a custom Policy Engine executable path is configured ', () => {
        // TODO: Add this test when we start generate actual test output.
        describe('when the path does not lead to a valid executable', () => {
          it.todo('uses the Policy Engine executable from the custom path');
        });

        describe('when the path does not lead to a valid executable', () => {
          it('Shows an error message', async () => {
            const userPolicyEnginePath = pathLib.join('made', 'up', 'path');

            const { exitCode, stdout } = await run(
              `snyk iac test ./iac/arm/rule_test.json --experimental`,
              {
                SNYK_IAC_POLICY_ENGINE_PATH: userPolicyEnginePath,
              },
            );

            expect(exitCode).toBe(2);
            expect(stdout).toContain(
              `Could not find a valid Policy Engine executable in the configured path: ${userPolicyEnginePath}` +
                '\nEnsure the configured path points to a valid Policy Engine executable.',
            );
          });
        });
      });
    });

    describe('without the --experimental flag', () => {
      it('does not divert to the new flow', async () => {
        const { exitCode, stdout } = await run(
          `snyk iac test ./iac/arm/rule_test.json`,
        );
        expect(stdout).toContain('Snyk Infrastructure as Code');
        expect(stdout).toContain('Issues');
        expect(exitCode).toBe(1);
      });
    });
  });

  describe(`"${cliUnifiedEngineFeatureFlag}" feature flag is OFF`, () => {
    it('does not divert to the new flow', async () => {
      server.setFeatureFlag(cliUnifiedEngineFeatureFlag, false);
      const { exitCode, stdout } = await run(
        `snyk iac test ./iac/arm/rule_test.json --experimental`,
      );
      expect(stdout).toContain('Unsupported flag "--experimental" provided');
      expect(exitCode).toBe(2);
    });
  });
});
