import stripAnsi = require('strip-ansi');
import { formatChangesSummary } from '../../../../src/lib/output-formatters/format-with-changes-item';
import { FixChangesSummary } from '../../../../src/types';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('format successful item', () => {
  it('successful item & changes formatted', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const changesSummary: FixChangesSummary[] = [
      {
        success: true,
        userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
        issueIds: ['vuln-2'],
      },
    ];
    const res = await formatChangesSummary(entity, changesSummary);
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
