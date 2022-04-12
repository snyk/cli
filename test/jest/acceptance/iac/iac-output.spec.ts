import { FakeServer } from '../../../acceptance/fake-server';
import { startMockServer } from './helpers';

const IAC_CLI_OUTPUT_FF = 'iacCliOutput';

describe('iac test output', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  const initialMessage =
    'Snyk testing Infrastructure as Code configuration issues...';

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await teardown();
  });

  describe(`with the ${IAC_CLI_OUTPUT_FF} feature flag`, () => {
    beforeEach(() => {
      server.setFeatureFlag(IAC_CLI_OUTPUT_FF, true);
    });

    it('should show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).toContain(
        'Snyk testing Infrastructure as Code configuration issues...',
      );
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

    describe('when providing a path to a valid file', () => {
      it('should not display the file meta sections', async () => {
        // Arrange
        const filePath = 'iac/arm/rule_test.json';

        // Act
        const { stdout } = await run(`snyk iac test ${filePath}`);

        // Assert
        expect(stdout).not.toContain(`
Type:              ARM
Target file:       ${filePath}
`);
      });

      it('should not display the file summary messages', async () => {
        // Arrange
        const filePath = 'iac/terraform/sg_open_ssh.tf';

        // Act
        const { stdout } = await run(`snyk iac test ${filePath}`);

        // Assert
        expect(stdout).not.toContain(`Tested ${filePath} for known issues`);
      });

      it('should display the test summary section with correct values', async () => {
        // Arrange
        const filePath = 'iac/kubernetes/pod-valid.json';
        const policyPath = `iac/policy/.snyk`;

        // Act
        const { stdout } = await run(
          `snyk iac test ${filePath} --policy-path=${policyPath}`,
        );
        expect(stdout).toContain(
          `Test Summary

  Organization: test-org

✔ Files without issues: 0
✗ Files with issues: 1
  Ignored issues: 2
  Total issues: 7 [ 0 critical, 1 high, 2 medium, 4 low ]`,
        );
      });
    });

    describe('when providing a path to a valid directory', () => {
      it('should not display the file meta sections', async () => {
        // Arrange
        const dirPath = 'iac/arm';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain(`
Type:              ARM
Target file:       ${dirPath}/`);
      });

      it('should not display the file summary messages', async () => {
        // Arrange
        const dirPath = 'iac/terraform';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).not.toContain(`Tested ${dirPath} for known issues`);
      });

      it('should display the test summary message', async () => {
        // Arrange
        const dirPath = 'iac/kubernetes';

        // Act
        const { stdout } = await run(`snyk iac test ${dirPath}`);

        // Assert
        expect(stdout).toContain(
          `Tested 3 projects, 3 contained issues. Failed to test 1 project.
Tip: Re-run in debug mode to see more information: DEBUG=*snyk* <COMMAND>
If the issue persists contact support@snyk.io`,
        );
      });

      it('should display the test summary section with correct values', async () => {
        // Arrange
        const dirPath = 'iac/kubernetes';
        const policyPath = `iac/policy/.snyk`;

        // Act
        const { stdout } = await run(
          `snyk iac test ${dirPath} --policy-path=${policyPath}`,
        );
        expect(stdout).toContain(
          `Test Summary

  Organization: test-org

✔ Files without issues: 0
✗ Files with issues: 3
  Ignored issues: 8
  Total issues: 28 [ 0 critical, 4 high, 8 medium, 16 low ]`,
        );
      });
    });
  });

  describe('without feature flag', () => {
    it('should not show an initial message', async () => {
      const { stdout } = await run('snyk iac test  ./iac/arm/rule_test.json');
      expect(stdout).not.toContain(initialMessage);
    });

    it('should not display the test summary section', async () => {
      // Arrange
      const filePath = 'iac/kubernetes/pod-valid.json';

      // Act
      const { stdout } = await run(`snyk iac test ${filePath}`);

      // Assert
      expect(stdout).not.toContain('Test Summary');
    });

    it('should display the file meta sections for each file', async () => {
      // Arrange
      const filePath = 'iac/arm/rule_test.json';

      // Act
      const { stdout } = await run(`snyk iac test ${filePath}`);

      // Assert
      expect(stdout).toContain(`
Organization:      test-org
Type:              ARM
Target file:       ${filePath}
Project name:      arm
Open source:       no
Project path:      ${filePath}
`);
    });

    it('should display the file summary messages', async () => {
      // Arrange
      const dirPath = 'iac/terraform';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).toMatch(
        new RegExp(`Tested .+ for known issues, found [0-9]+ issues`),
      );
    });

    it('should display a test summary message', async () => {
      // Arrange
      const dirPath = 'iac/kubernetes';

      // Act
      const { stdout } = await run(`snyk iac test ${dirPath}`);

      // Assert
      expect(stdout).toMatch(
        new RegExp(
          `Tested [0-9]+ projects?, [0-9]+ contained issues.( Failed to test [0-9]+ projects?.)?`,
        ),
      );
    });
  });
});
