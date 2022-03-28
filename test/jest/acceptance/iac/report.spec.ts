import { startMockServer } from './helpers';
import { FakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(50_000);

describe('iac report', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let API_HOST: string;

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
    API_HOST = `http://localhost:${server.getPort()}`;
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => teardown());

  it('should return exit code 1', async () => {
    // Act
    const { exitCode } = await run(`snyk iac report ./iac/arm/rule_test.json`);

    // Assert
    expect(exitCode).toEqual(1);
  });

  it('should include test results in the output', async () => {
    const { stdout } = await run(`snyk iac report ./iac/arm/rule_test.json`);

    expect(stdout).toContain('Infrastructure as code issues:');
  });

  it('should include a link to the projects page in the output', async () => {
    const { stdout } = await run(`snyk iac report ./iac/arm/rule_test.json`);

    expect(stdout).toContain(
      `Your test results are available at: ${API_HOST}/org/test-org/projects under the name snyk/cli`,
    );
  });

  it('should forward the scan results to the /iac-cli-share-results endpoint', async () => {
    // Act
    await run(`snyk iac report ./iac/arm/rule_test.json`);

    // Assert
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
              remoteUrl: 'http://github.com/snyk/cli.git',
            },
          },
        ],
      }),
    );
  });

  describe("when called without the 'iacCliShareResults' feature flag", () => {
    it('should return an error status code', async () => {
      // Arrange
      server.setFeatureFlag('iacCliShareResults', false);

      // Act
      const { exitCode } = await run(
        `snyk iac report ./iac/arm/rule_test.json`,
      );

      // Assert
      expect(exitCode).toBe(2);
    });

    it('should print an appropriate error message', async () => {
      // Arrange
      server.setFeatureFlag('iacCliShareResults', false);

      // Act
      const { stdout } = await run(`snyk iac report ./iac/arm/rule_test.json`);

      // Assert
      expect(stdout).toMatch(
        "Feature flag 'iacCliShareResults' is not currently enabled for your org, to enable please contact snyk support",
      );
    });
  });

  describe("when called without a preceding 'iac'", () => {
    it('should return an error status code', async () => {
      // Act
      const { exitCode } = await run(`snyk report ./iac/arm/rule_test.json`);

      // Assert
      expect(exitCode).toBe(2);
    });

    it('should print an appropriate error message', async () => {
      // Act
      const { stdout } = await run(`snyk report ./iac/arm/rule_test.json`);

      // Assert
      expect(stdout).toContain(
        '"report" is not a supported command. Did you mean to use "iac report"?',
      );
    });

    it('should return an empty stderr', async () => {
      // Act
      const { stderr } = await run(`snyk report ./iac/arm/rule_test.json`);

      // Assert
      expect(stderr).toEqual('');
    });
  });
});
