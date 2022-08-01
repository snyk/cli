import { FakeServer } from '../../../../acceptance/fake-server';
import { isValidJSONString, startMockServer } from '../helpers';
import {
  spinnerMessage,
  spinnerSuccessMessage,
} from '../../../../../src/lib/formatters/iac-output';

const IAC_CLI_OUTPUT_FF = 'iacCliOutputRelease';

jest.setTimeout(1_000 * 30);

describe('iac test SARIF output', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await teardown();
  });

  describe.each`
    outputFFValue
    ${true}
    ${false}
  `(
    `with \`${IAC_CLI_OUTPUT_FF}\` feature flag as \`$outputFFValue\``,
    ({ outputFFValue }) => {
      beforeEach(() => {
        server.setFeatureFlag(IAC_CLI_OUTPUT_FF, outputFFValue);
      });

      it('should not show an initial message', async () => {
        // Arrange
        const filePath = './iac/arm/rule_test.json';

        // Act
        const { stdout } = await run(`snyk iac test --sarif ${filePath}`);

        // Assert
        expect(stdout).not.toContain(spinnerMessage);
      });

      it('should not show spinner messages', async () => {
        // Arrange
        const filePath = './iac/arm/rule_test.json';

        // Act
        const { stdout } = await run(`snyk iac test --sarif ${filePath}`);

        // Asset
        expect(stdout).not.toContain(spinnerMessage);
        expect(stdout).not.toContain(spinnerSuccessMessage);
      });

      describe('with multiple paths', () => {
        it('should return valid output', async () => {
          // Arrange
          const paths = ['./iac/arm/rule_test.json', './iac/cloudformation'];

          // Act
          const { stdout, exitCode } = await run(
            `snyk iac test --sarif ${paths.join(' ')}`,
          );

          // Assert
          expect(isValidJSONString(stdout)).toBe(true);

          expect(stdout).toContain('"id": "SNYK-CC-TF-20",');
          expect(stdout).toContain('"id": "SNYK-CC-AWS-422",');
          expect(exitCode).toBe(1);
        });
      });
    },
  );
});
