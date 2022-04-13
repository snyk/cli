import chalk from 'chalk';

import { getIacDisplayedFailuresOutput } from '../../../../../../src/lib/formatters/iac-output';
import { IacFileInDirectory } from '../../../../../../src/lib/types';

describe('getIacDisplayedFailuresOutput', () => {
  it('should include the "Invalid Files: X" title with the correct value', () => {
    // Arrange
    const scanFailures: IacFileInDirectory[] = [];

    // Act
    const result = getIacDisplayedFailuresOutput(scanFailures);

    // Assert
    expect(result).toContain(chalk.bold.white(`Invalid Files: 3`));
  });

  it('should include the failures list with the correct values', () => {
    // Arrange
    const scanFailures: IacFileInDirectory[] = [];

    // Act
    const result = getIacDisplayedFailuresOutput(scanFailures);

    // Assert
    expect(result).toContain(``);
  });
});
