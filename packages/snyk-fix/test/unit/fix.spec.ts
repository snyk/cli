import * as snykFix from '../../src';
import { generateEntityToFix } from '../helpers/generate-entity-to-fix';
describe('Snyk fix', () => {
  it('Snyk fix throws error when called with unsupported type', () => {
    const projectTestResult = generateEntityToFix('npm', 'package.json');
    expect(
      snykFix.fix([projectTestResult]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      '"Provided scan type is not supported"',
    );
  });
  it('Snyk fix returns results for supported type', async () => {
    const projectTestResult = generateEntityToFix('pip', 'requirements.txt');
    const res = await snykFix.fix([projectTestResult]);
    expect(res).toMatchSnapshot();
  });
});
