import { formatChangesSummary } from '../../../../src/lib/output-formatters/format-successful-item';
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
      },
    ];
    const res = await formatChangesSummary(entity, changesSummary);
    expect(res).toMatchSnapshot();
  });
});
