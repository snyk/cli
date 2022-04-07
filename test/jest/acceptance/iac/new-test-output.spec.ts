import { FakeServer } from '../../../acceptance/fake-server';
import { startMockServer } from './helpers';

describe('New IaC Test Output', () => {
  const initialMessage =
    'Snyk testing Infrastructure as Code configuration issues...';

  let server: FakeServer;
  let run;
  let teardown;

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterAll(async () => {
    await teardown();
  });

  describe('with feature flag enabled', () => {
    beforeEach(() => {
      server.setFeatureFlag('iacCliOutput', true);
    });

    afterEach(() => {
      server.restore();
    });

    it('should show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).toContain(initialMessage);
    });

    it('should not show an initial message for JSON output', async () => {
      const { stdout } = await run(
        'snyk iac test --json  ./iac/arm/rule_test.json',
      );
      expect(stdout).not.toContain(initialMessage);
    });

    it('should not show an initial message for SARIF output', async () => {
      const { stdout } = await run(
        'snyk iac test --sarif  ./iac/arm/rule_test.json',
      );
      expect(stdout).not.toContain(initialMessage);
    });
  });

  describe('with feature flag disabled', () => {
    it('should not show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).not.toContain(initialMessage);
    });
  });
});
