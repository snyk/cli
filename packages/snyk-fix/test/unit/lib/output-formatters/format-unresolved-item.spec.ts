import stripAnsi = require('strip-ansi');
import { formatUnresolved } from '../../../../src/lib/output-formatters/format-unresolved-item';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('format unresolved item', () => {
  it('successful item & changes formatted', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const res = await formatUnresolved(entity, 'Failed to process item');
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
