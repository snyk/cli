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

      expect(stdout).toMatch(
        'Flag "--report" is only supported if feature flag "iacCliShareResults" is enabled. To enable it, please contact Snyk support.',
      );
      expect(exitCode).toBe(2);
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

      expect(stdout).toContain(
        `Your test results are available at: http://localhost:${server.getPort()}/org/test-org/projects`,
      );
      expect(stdout).toContain('under the name: fixtures');
      expect(exitCode).toBe(1);
    });

    it('forwards value to iac-cli-share-results endpoint', async () => {
      const { exitCode } = await run(
        `snyk iac test ./iac/arm/rule_test.json --report`,
      );

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
                targetFile: 'iac/arm/rule_test.json',
              },
              facts: [],
              findings: expect.any(Array),
              policy: '',
              name: 'fixtures',
              target: {
                name: 'fixtures',
              },
            },
          ],
        }),
      );
      expect(exitCode).toEqual(1);
    });

    it('forwards project tags', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --tags=foo=bar',
      );

      const requests = server
        .getRequests()
        .filter((request) => request.url.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);

      const [request] = requests;

      expect(request.body).toMatchObject({
        tags: [{ key: 'foo', value: 'bar' }],
      });
      expect(exitCode).toEqual(1);
    });

    it('forwards project environment', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-environment=saas',
      );

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
      expect(exitCode).toEqual(1);
    });

    it('forwards project lifecycle', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-lifecycle=sandbox',
      );

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
      expect(exitCode).toEqual(1);
    });

    it('forwards project business criticality', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-business-criticality=high',
      );

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
      expect(exitCode).toEqual(1);
    });

    it('should print an error message if test usage is exceeded', async () => {
      server.setNextStatusCode(429);

      const { stdout, exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --project-business-criticality=high --org=1234',
      );

      expect(stdout).toMatch(/test limit reached/i);
      expect(exitCode).toEqual(2);
    });

    it('should filter out NONE custom policies severity issues and then forward', async () => {
      const { exitCode } = await run(
        'snyk iac test ./iac/arm/rule_test.json --report --org=custom-policies',
      );

      const requests = server
        .getRequests()
        .filter((request) => request.url?.includes('/iac-cli-share-results'));

      expect(requests.length).toEqual(1);
      const [request] = requests;
      expect(request.body).toEqual(
        expect.objectContaining({
          contributors: expect.any(Array),
          scanResults: [
            {
              identity: {
                type: 'armconfig',
                targetFile: 'iac/arm/rule_test.json',
              },
              facts: [],
              findings: expect.any(Array),
              policy: '',
              name: 'fixtures',
              target: {
                name: 'fixtures',
              },
            },
          ],
        }),
      );
      // The other SNYK-CC-AZURE-543 issue has been filtered out
      expect(request.body.scanResults[0].findings.length).toEqual(1);
      expect(exitCode).toEqual(1);
    });

    describe('with target reference', () => {
      it('forwards the target reference to iac-cli-share-results endpoint', async () => {
        const testTargetRef = 'test-target-ref';

        const { exitCode } = await run(
          `snyk iac test ./iac/arm/rule_test.json --report --target-reference=${testTargetRef}`,
        );

        const testRequests = server
          .getRequests()
          .filter((request) => request.url?.includes('/iac-cli-share-results'));
        expect(testRequests[0]).toMatchObject({
          body: {
            contributors: expect.any(Array),
            scanResults: [
              {
                identity: {
                  type: 'armconfig',
                  targetFile: 'iac/arm/rule_test.json',
                },
                facts: [],
                findings: expect.arrayContaining([]),
                name: 'fixtures',
                target: {
                  name: 'fixtures',
                },
                targetReference: testTargetRef,
              },
            ],
          },
        });
        expect(exitCode).toEqual(1);
      });
    });
  });
});
