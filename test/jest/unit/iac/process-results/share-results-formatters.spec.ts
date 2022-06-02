import { formatShareResults } from '../../../../../src/cli/commands/test/iac/local-execution/process-results/v1/share-results-formatter';
import { generateScanResults } from '../results-formatter.fixtures';
import { expectedFormattedResultsForShareResults } from './share-results-formatters.fixtures';
import * as git from '../../../../../src/lib/iac/git';

describe('formatShareResults', () => {
  beforeAll(() => {
    jest
      .spyOn(git, 'getWorkingDirectoryForPath')
      .mockImplementation(() => process.cwd());
  });

  it('returns the formatted results', () => {
    const IacShareResultsFormatResults = formatShareResults(
      generateScanResults(),
    );
    expect(IacShareResultsFormatResults).toStrictEqual(
      expectedFormattedResultsForShareResults,
    );
  });
});
