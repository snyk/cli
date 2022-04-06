import * as iacOutputV1 from '../../../../../../src/lib/formatters/iac-output/v1';
import * as iacOutputV2 from '../../../../../../src/lib/formatters/iac-output/v2';
import { getIacDisplayErrorFileOutput } from '../../../../../../src/lib/formatters/iac-output';
import { IacFileInDirectory } from '../../../../../../src/lib/types';

describe('IaC Output Formatter', () => {
  const IAC_CLI_OUTPUT_FF = 'iacCliOutput';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getIacDisplayErrorFileOutput', () => {
    it('should use the implementation from v1 with the provided arguments', () => {
      // Arrange
      const getIacDisplayErrorFileOutputV1Spy = jest
        .spyOn(iacOutputV1, 'getIacDisplayErrorFileOutput')
        .mockImplementationOnce(jest.fn());

      const getIacDisplayErrorFileOutputV2Spy = jest
        .spyOn(iacOutputV2, 'getIacDisplayErrorFileOutput')
        .mockImplementationOnce(jest.fn());

      const args: Parameters<typeof getIacDisplayErrorFileOutput> = [
        {} as IacFileInDirectory,
      ];

      // Act
      const result = getIacDisplayErrorFileOutput(...args);

      // Assert
      expect(result).toBeUndefined();
      expect(getIacDisplayErrorFileOutputV1Spy).toHaveBeenCalledTimes(1);
      expect(getIacDisplayErrorFileOutputV2Spy).not.toHaveBeenCalled();
      expect([
        ...getIacDisplayErrorFileOutputV1Spy.mock.calls[0],
      ]).toStrictEqual(args);
    });

    describe(`when the org has the ${IAC_CLI_OUTPUT_FF} feature flag`, () => {
      it('should use the implementation from v2 with the provided arguments', () => {
        // Arrange
        const getIacDisplayErrorFileOutputV1Spy = jest
          .spyOn(iacOutputV1, 'getIacDisplayErrorFileOutput')
          .mockImplementationOnce(jest.fn());

        const getIacDisplayErrorFileOutputV2Spy = jest
          .spyOn(iacOutputV2, 'getIacDisplayErrorFileOutput')
          .mockImplementationOnce(jest.fn());

        const args: Parameters<typeof getIacDisplayErrorFileOutput> = [
          {} as IacFileInDirectory,
          true,
        ];

        // Act
        const result = getIacDisplayErrorFileOutput(...args);

        // Assert
        expect(result).toBeUndefined();
        expect(getIacDisplayErrorFileOutputV1Spy).not.toHaveBeenCalled();
        expect(getIacDisplayErrorFileOutputV2Spy).toHaveBeenCalledTimes(1);
        expect([
          ...getIacDisplayErrorFileOutputV2Spy.mock.calls[0],
        ]).toStrictEqual(args.slice(0, args.length - 1));
      });
    });
  });
});
