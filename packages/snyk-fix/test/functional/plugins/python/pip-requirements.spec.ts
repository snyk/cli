import { isSupported } from '../../../../src/plugins/python/handlers/pip-requirements';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('isSupported', () => {
  it('with missing remediation is not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    delete entity.testResult.remediation;
    expect(await isSupported(entity)).toBeFalsy();
  });
  it('with -r directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-r prod.txt\nDjango==1.6.1',
    );
    expect(await isSupported(entity)).toBeFalsy();
  });
  it('with -c directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );
    expect(await isSupported(entity)).toBeFalsy();
  });
  it('with -e directive in the manifest is supported', async () => {
    const entity = generateEntityToFix('pip', 'requirements.txt', '-e .');
    expect(await isSupported(entity)).toBeTruthy();
  });
});
