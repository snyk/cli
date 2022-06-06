import { startMockServer } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50_000);

describe('iac --experimental', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  const upeFeatureFlag = 'iacCliUnifiedEngine';

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  describe(`"${upeFeatureFlag}" feature flag is ON`, () => {
    beforeEach(() => {
      server.setFeatureFlag(upeFeatureFlag, true);
      server.setFeatureFlag('iacCliOutputRelease', true);
    });

    it('diverts to the new flow when --experimental flag is used', async () => {
      const { exitCode, stdout } = await run(
        `snyk iac test ./iac/arm/rule_test.json --experimental`,
      );
      expect(stdout).not.toContain('Snyk Infrastructure as Code');
      expect(stdout).not.toContain('Issues');
      expect(exitCode).toBe(0);
    });

    it('does not divert to the new flow without --experimental flag', async () => {
      const { exitCode, stdout } = await run(
        `snyk iac test ./iac/arm/rule_test.json`,
      );
      expect(stdout).toContain('Snyk Infrastructure as Code');
      expect(stdout).toContain('Issues');
      expect(exitCode).toBe(1);
    });
  });

  describe(`"${upeFeatureFlag}" feature flag is OFF`, () => {
    it('does not divert to the new flow with just --experimental flag', async () => {
      server.setFeatureFlag(upeFeatureFlag, false);
      const { exitCode, stdout } = await run(
        `snyk iac test ./iac/arm/rule_test.json --experimental`,
      );
      expect(stdout).toContain('Unsupported flag "--experimental" provided');
      expect(exitCode).toBe(2);
    });
  });
});
