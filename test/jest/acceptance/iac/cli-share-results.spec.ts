import { FakeServer } from '../../../acceptance/fake-server';
import { startMockServer } from './helpers';

jest.setTimeout(50000);

describe('CLI Share Results', () => {
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

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  describe('feature flag is not enabled', () => {
    beforeAll(() => {
      server.setFeatureFlag('iacCliShareResults', false);
    });

    it('the output includes an error', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );
      expect(exitCode).toBe(2);

      expect(stdout).toMatch(
        'Flag "--report" is only supported if feature flag "iacCliShareResults" is enabled. To enable it, please contact Snyk support.',
      );
    });
  });

  describe('feature flag is enabled', () => {
    beforeAll(() => {
      server.setFeatureFlag('iacCliShareResults', true);
    });

    it('the output of a regular scan includes a link to the projects page', async () => {
      const { stdout, exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );
      expect(exitCode).toBe(1);

      expect(stdout).toContain(
        `Your test results are available at: http://localhost:${server.getPort()}/org/test-org/projects under the name arm`,
      );
    });

    it('forwards value to iac-cli-share-results endpoint', async () => {
      const { exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );

      expect(exitCode).toEqual(1);

      const testRequests = server
        .getRequests()
        .filter((request) => request.url?.includes('/iac-cli-share-results'));

      expect(testRequests.length).toEqual(1);
      expect(testRequests[0].body).toEqual(
        expect.objectContaining({
          contributors: expect.any(Array),
          scanResults: [
            {
              identity: {
                type: 'armconfig',
                targetFile: './iac/arm/rule_test.json',
              },
              facts: [],
              findings: expect.any(Array),
              policy: '',
              name: 'arm',
              target: {
                branch: 'master',
                remoteUrl: 'http://github.com/snyk/cli.git',
              },
            },
          ],
        }),
      );
    });

    it('forwards project tags', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --tags=foo=bar',
      );

      expect(exitCode).toEqual(1);

      const requests = server
        .getRequests()
        .filter((request) => request.url.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);

      const [request] = requests;

      expect(request.body).toMatchObject({
        tags: [{ key: 'foo', value: 'bar' }],
      });
    });

    it('forwards project environment', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-environment=saas',
      );

      expect(exitCode).toEqual(1);

      const requests = server
        .getRequests()
        .filter((request) => request.url.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);

      const [request] = requests;

      expect(request.body).toMatchObject({
        attributes: {
          environment: ['saas'],
        },
      });
    });

    it('forwards project lifecycle', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-lifecycle=sandbox',
      );

      expect(exitCode).toEqual(1);

      const requests = server
        .getRequests()
        .filter((request) => request.url.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);

      const [request] = requests;

      expect(request.body).toMatchObject({
        attributes: {
          lifecycle: ['sandbox'],
        },
      });
    });

    it('forwards project business criticality', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-business-criticality=high',
      );

      expect(exitCode).toEqual(1);

      const requests = server
        .getRequests()
        .filter((request) => request.url.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);

      const [request] = requests;

      expect(request.body).toMatchObject({
        attributes: {
          criticality: ['high'],
        },
      });
    });
  });
});
