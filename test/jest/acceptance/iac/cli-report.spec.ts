import { startMockServer } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50000);

describe('CLI Report', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;

  beforeAll(async () => {
    const result = await startMockServer();
    server = result.server;
    run = result.run;
    teardown = result.teardown;
  });

  afterAll(async () => teardown());

  describe('feature flag is not enabled', () => {
    beforeAll(async () => {
      server.setFeatureFlag('iacCliReport', false);
    });

    it('the output includes an error', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );
      expect(exitCode).toBe(2);

      expect(stdout).toContain(
        'Flag "--report" is only supported if feature flag "iacCliReport" is enabled. To enable it, please contact snyk support.',
      );
      expect(stdout).not.toContain('CLI Report is available at:');
    });
  });

  describe('feature flag is enabled', () => {
    beforeAll(async () => {
      server.setFeatureFlag('iacCliReport', true);
    });

    it('the output of a regular scan includes a link to the projects page', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain('CLI Report is available at:');
    });

    it('the output of a scan with the JSON flag does not includes a link to the projects page', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report --json`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).not.toContain('CLI Report is available at:');
    });

    it('the output of a scan with the SARIF flag does not includes a link to the projects page', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report --sarif`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).not.toContain('CLI Report is available at:');
    });
  });
});
