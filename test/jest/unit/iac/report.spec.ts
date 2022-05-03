import * as featureFlags from '../../../../src/lib/feature-flags';
import * as runTest from '../../../../src/cli/commands/test/iac';
import report from '../../../../src/cli/commands/report';
import { ArgsOptions } from '../../../../src/cli/args';
import { UnsupportedFeatureFlagError } from '../../../../src/lib/errors';
import { TestCommandResult } from '../../../../src/cli/commands/types';
import { UnsupportedReportCommandError } from '../../../../src/cli/commands/report/errors/unsupported-report-command';

describe('report', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should call the 'test' function", async () => {
    // Arrange
    const iacTestOptions: any = { iac: true };
    const fakePath = './fake-path';

    const runTestOutput = TestCommandResult.createHumanReadableTestCommandResult(
      'fake-output',
      'fake-json-output',
      'fake-sarif-output',
    );

    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockImplementation(async () => true);

    const runTestSpy = jest
      .spyOn(runTest, 'default')
      .mockImplementation(async () => runTestOutput);

    // Act
    await report(fakePath, iacTestOptions);

    // Assert
    expect(runTestSpy).toBeCalledTimes(1);
    expect(runTestSpy).toHaveBeenCalledWith(
      true,
      fakePath,
      expect.objectContaining(iacTestOptions),
    );
  });

  it('should add the report option', async () => {
    // Arrange
    const iacTestOptions: any = { iac: true };
    const fakePath = './fake-path';

    const runTestOutput = TestCommandResult.createHumanReadableTestCommandResult(
      'fake-output',
      'fake-json-output',
      'fake-sarif-output',
    );

    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockImplementation(async () => true);

    const runTestSpy = jest
      .spyOn(runTest, 'default')
      .mockImplementation(async () => runTestOutput);

    // Act
    await report(fakePath, iacTestOptions);

    // Assert
    expect(runTestSpy).toBeCalledTimes(1);

    const testCallArgs = runTestSpy.mock.calls[0];
    expect(testCallArgs[testCallArgs.length - 1]).toStrictEqual({
      ...iacTestOptions,
      report: true,
    });
  });

  it("should return the 'test' function's output", async () => {
    // Arrange
    const iacTestOptions: any = { iac: true };
    const fakePath = './fake-path';

    const runTestOutput = TestCommandResult.createHumanReadableTestCommandResult(
      'fake-output',
      'fake-json-output',
      'fake-sarif-output',
    );

    jest
      .spyOn(featureFlags, 'hasFeatureFlag')
      .mockImplementation(async () => true);

    jest
      .spyOn(runTest, 'default')
      .mockImplementation(async () => runTestOutput);

    // Act
    const result = await report(fakePath, iacTestOptions);

    // Assert
    expect(result).toStrictEqual(runTestOutput);
  });

  describe("when the org does not have the 'iacCliShareResults' feature flag", () => {
    it('should throw an appropriate error', async () => {
      // Arrange
      const iacTestOptions: any = { iac: true };
      const fakePath = './fake-path';

      const runTestOutput = TestCommandResult.createHumanReadableTestCommandResult(
        'fake-output',
        'fake-json-output',
        'fake-sarif-output',
      );

      jest
        .spyOn(featureFlags, 'hasFeatureFlag')
        .mockImplementation(
          async (featureFlag) => featureFlag !== 'iacCliShareResults',
        );

      jest
        .spyOn(runTest, 'default')
        .mockImplementation(async () => runTestOutput);

      // Act + Assert
      await expect(report(fakePath, iacTestOptions)).rejects.toThrow(
        UnsupportedFeatureFlagError,
      );
    });

    it("should not call the 'test' function", async () => {
      // Arrange
      const iacTestOptions = {} as ArgsOptions;
      const fakePath = './fake-path';

      const runTestOutput: any = TestCommandResult.createHumanReadableTestCommandResult(
        'fake-output',
        'fake-json-output',
        'fake-sarif-output',
      );

      jest
        .spyOn(featureFlags, 'hasFeatureFlag')
        .mockImplementation(
          async (featureFlag) => featureFlag !== 'iacCliShareResults',
        );

      const runTestSpy = jest
        .spyOn(runTest, 'default')
        .mockImplementation(async () => runTestOutput);

      // Act
      await expect(report(fakePath, iacTestOptions)).rejects.toThrow();

      // Assert
      expect(runTestSpy).not.toHaveBeenCalled();
    });
  });

  describe("when options do not include 'iac'", () => {
    it('should throw an appropriate error', async () => {
      // Arrange
      const iacTestOptions = {} as ArgsOptions;
      const fakePath = './fake-path';

      const runTestOutput = TestCommandResult.createHumanReadableTestCommandResult(
        'fake-output',
        'fake-json-output',
        'fake-sarif-output',
      );

      jest
        .spyOn(featureFlags, 'hasFeatureFlag')
        .mockImplementation(
          async (featureFlag) => featureFlag !== 'iacCliShareResults',
        );

      jest
        .spyOn(runTest, 'default')
        .mockImplementation(async () => runTestOutput);

      // Act + Assert
      await expect(report(fakePath, iacTestOptions)).rejects.toThrow(
        UnsupportedReportCommandError,
      );
    });

    it("should not call the 'test' function", async () => {
      // Arrange
      const iacTestOptions = {} as ArgsOptions;
      const fakePath = './fake-path';

      const runTestOutput: any = TestCommandResult.createHumanReadableTestCommandResult(
        'fake-output',
        'fake-json-output',
        'fake-sarif-output',
      );

      jest
        .spyOn(featureFlags, 'hasFeatureFlag')
        .mockImplementation(
          async (featureFlag) => featureFlag !== 'iacCliShareResults',
        );

      const runTestSpy = jest
        .spyOn(runTest, 'default')
        .mockImplementation(async () => runTestOutput);

      // Act
      await expect(report(fakePath, iacTestOptions)).rejects.toThrow();

      // Assert
      expect(runTestSpy).not.toHaveBeenCalled();
    });
  });
});
