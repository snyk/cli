import { isSupported } from '../../../../src/plugins/python/handlers/is-supported';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('isSupported', () => {
  it('with missing remediation is not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore: for test purpose only
    delete entity.testResult.remediation;
    const res = await isSupported(entity);
    expect(res.supported).toBeFalsy();
  });

  it('with empty Pins is not supported', async () => {
    const entity = generateEntityToFix(
      'poetry',
      'pyproject.toml',
      JSON.stringify({}),
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore: for test purpose only
    delete entity.testResult.remediation;
    // @ts-ignore: for test purpose only
    entity.testResult.remediation = {
      unresolved: [],
      upgrade: {
        'django@1.6.1': {
          upgradeTo: 'django@2.0.1',
          vulns: ['vuln-id'],
          isTransitive: false,
        },
      },
      patch: {},
      ignore: {},
      pin: {},
    };
    const res = await isSupported(entity);
    expect(res.supported).toBeFalsy();
  });
  it('with -r directive in the manifest is supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-r prod.txt\nDjango==1.6.1',
    );
    const res = await isSupported(entity);
    expect(res.supported).toBeTruthy();
  });
  it('with -c directive in the manifest is supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );
    const res = await isSupported(entity);
    expect(res.supported).toBeTruthy();
  });
  it('with -e directive in the manifest is supported', async () => {
    const entity = generateEntityToFix('pip', 'requirements.txt', '-e .');
    entity.testResult.remediation!.pin = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        isTransitive: false,
      },
    };
    const res = await isSupported(entity);
    expect(res.supported).toBeTruthy();
  });
});
