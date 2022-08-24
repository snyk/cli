import * as fs from 'fs';
import * as pathLib from 'path';
import { matchers } from 'jest-json-schema';

import { FakeServer } from '../../../../acceptance/fake-server';
import { startMockServer } from '../helpers';
import {
  spinnerMessage,
  spinnerSuccessMessage,
} from '../../../../../src/lib/formatters/iac-output/text';

expect.extend(matchers);

const testResultJsonSchema = JSON.parse(
  fs.readFileSync(
    pathLib.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fixtures',
      'iac',
      'output-formats',
      'test-result-json-schema.json',
    ),
    'utf-8',
  ),
);

const testResultsJsonSchema = {
  type: 'array',
  items: testResultJsonSchema,
};

const testErrorJsonSchema = JSON.parse(
  fs.readFileSync(
    pathLib.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fixtures',
      'iac',
      'output-formats',
      'test-error-json-schema.json',
    ),
    'utf-8',
  ),
);

const testErrorsJsonSchema = {
  type: 'array',
  items: testErrorJsonSchema,
};

jest.setTimeout(1_000 * 30);

describe('iac test JSON output', () => {
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

  it('should not show an initial message', async () => {
    // Arrange
    const filePath = './iac/arm/rule_test.json';

    // Act
    const { stdout } = await run(`snyk iac test --json ${filePath}`);

    // Assert
    expect(stdout).not.toContain(spinnerMessage);
  });

  it('should not show spinner messages', async () => {
    // Arrange
    const filePath = './iac/arm/rule_test.json';

    // Act
    const { stdout } = await run(`snyk iac test --json ${filePath}`);

    // Asset
    expect(stdout).not.toContain(spinnerMessage);
    expect(stdout).not.toContain(spinnerSuccessMessage);
  });

  describe('with a single file', () => {
    describe('when the test is successful', () => {
      it('should output a result in the correct schema', async () => {
        // Arrange
        const filePath = 'iac/cloudformation/aurora-valid.yml';

        // Act
        const { stdout } = await run(`snyk iac test --json ${filePath}`);
        const outputJson = JSON.parse(stdout);

        // Assert
        expect(outputJson).toMatchSchema(testResultJsonSchema);
      });
    });

    describe('when the test fails', () => {
      it('should output an error in the correct schema', async () => {
        // Arrange
        const filePath = 'iac/only-invalid/invalid-file1.yml';

        // Act
        const { stdout } = await run(`snyk iac test --json ${filePath}`);
        const outputJson = JSON.parse(stdout);

        // Assert
        expect(outputJson).toMatchSchema(testErrorJsonSchema);
      });
    });
  });

  describe('with multiple files', () => {
    describe('with some successful tests', () => {
      it('should output results in the correct schema', async () => {
        // Arrange
        const dirPath = 'iac';

        // Act
        const { stdout } = await run(`snyk iac test --json ${dirPath}`);
        const outputJson = JSON.parse(stdout);

        // Assert
        expect(outputJson).toMatchSchema(testResultsJsonSchema);
      });

      describe('with multiple paths', () => {
        it('should return valid output', async () => {
          // Arrange
          const paths = ['./iac/arm/rule_test.json', './iac/cloudformation'];

          // Act
          const { stdout, exitCode } = await run(
            `snyk iac test --json ${paths.join(' ')}`,
          );

          // Assert
          const outputJson = JSON.parse(stdout);
          expect(outputJson).toMatchSchema(testResultsJsonSchema);

          expect(stdout).toContain('"id": "SNYK-CC-TF-20",');
          expect(stdout).toContain('"id": "SNYK-CC-AWS-422",');
          expect(exitCode).toBe(1);
        });
      });
    });

    describe('with only failing tests', () => {
      it('should output errors in the correct schema', async () => {
        // Arrange
        const dirPath = 'iac/only-invalid';

        // Act
        const { stdout } = await run(`snyk iac test --json ${dirPath}`);
        const outputJson = JSON.parse(stdout);

        // Assert
        expect(outputJson).toMatchSchema(testErrorsJsonSchema);
      });
    });
  });
});
