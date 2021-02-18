import { notSupported } from '../../../../src/plugins/python/handlers/pip-requirements';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('notSupported', () => {
  it('with missing remediation is not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    delete entity.testResult.remediation;
    expect(await notSupported(entity)).toBeTruthy();
  });
  it('with -r directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-r prod.txt\nDjango==1.6.1',
    );
    expect(await notSupported(entity)).toBeTruthy();
  });
  it('with -c directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );
    expect(await notSupported(entity)).toBeTruthy();
  });
  it('with -e directive in the manifest is supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-e .',
    );
    expect(await notSupported(entity)).toBeFalsy();
  });
});
