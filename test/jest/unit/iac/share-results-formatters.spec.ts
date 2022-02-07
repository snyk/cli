import { formatShareResults } from '../../../../src/cli/commands/test/iac-local-execution/share-results-formatter';
import { generateScanResults } from './results-formatter.fixtures';
import { expectedFormattedResultsForShareResults } from './share-results-formatters.fixtures';

describe('formatShareResults', () => {
  it('returns the formatted results', () => {
    const IacShareResultsFormatResults = formatShareResults(
      generateScanResults(),
      {},
    );
    expect(IacShareResultsFormatResults).toStrictEqual(
      expectedFormattedResultsForShareResults,
    );
  });
});
