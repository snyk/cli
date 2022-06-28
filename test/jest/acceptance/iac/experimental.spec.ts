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

        expect(exitCode).toBe(0);
      });

      describe('when a custom Test Engine executable path is configured ', () => {
        // TODO: Add this test when we start generate actual test output.
        describe('when the path does not lead to a valid executable', () => {
          it.todo('uses the Test Engine executable from the custom path');
        });

        describe('when the path does not lead to a valid executable', () => {
          it('Shows an error message', async () => {
            const userTestEnginePath = pathLib.join('made', 'up', 'path');

            const { exitCode, stdout } = await run(
              `snyk iac test ./iac/arm/rule_test.json --experimental`,
              {
                SNYK_IAC_TEST_ENGINE_PATH: userTestEnginePath,
              },
            );

            expect(exitCode).toBe(2);
            expect(stdout).toContain(
              `Could not find a valid Test Engine executable in the configured path: ${userTestEnginePath}` +
                '\nEnsure the configured path points to a valid Test Engine executable.',
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
