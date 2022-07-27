import { formatShareResults } from '../../../../../src/cli/commands/test/iac/local-execution/process-results/share-results-formatter';
import { generateScanResults } from '../results-formatter.fixtures';
import { expectedFormattedResultsForShareResults } from './share-results-formatters.fixtures';
import * as git from '../../../../../src/lib/iac/git';
import * as path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');

describe('formatShareResults', () => {
  beforeAll(() => {
    jest
      .spyOn(git, 'getWorkingDirectoryForPath')
      .mockImplementation(() => projectRoot);
  });

  it('returns the formatted results', () => {
    const IacShareResultsFormatResults = formatShareResults(
      projectRoot,
      generateScanResults(),
      {
        projectName: path.basename(projectRoot),
        orgName: 'org-name',
      },
    );
    expect(IacShareResultsFormatResults).toStrictEqual(
      expectedFormattedResultsForShareResults,
    );
  });
});
