import {
  isSupported,
  containsRequireDirective,
} from '../../../../src/plugins/python/handlers/pip-requirements';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('isSupported', () => {
  it('with missing remediation is not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    // @ts-ignore: for test purpose only
    delete entity.testResult.remediation;
    const res = await isSupported(entity);
    expect(res.supported).toBeFalsy();
  });
  it('with -r directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-r prod.txt\nDjango==1.6.1',
    );
    const res = await isSupported(entity);
    expect(res.supported).toBeFalsy();
  });
  it('with -c directive in the manifest not supported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      '-c constraints.txt',
    );
    const res = await isSupported(entity);
    expect(res.supported).toBeFalsy();
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

describe('containsRequireDirective', () => {
  it('with -r', async () => {
    const res = await containsRequireDirective('-r requirements.txt');
    expect(res.matches[0][0]).toEqual('-r requirements.txt');
    expect(res).toMatchSnapshot();
  });
  it('without -r', async () => {
    const res = await containsRequireDirective('Jinja2==1.2.3');
    expect(res).toEqual({
      containsRequire: false,
      matches: [],
    });
  });

  it('with multiple -r', async () => {
    const res = await containsRequireDirective(
      '-r requirements.txt\n-r base.txt',
    );
    expect(res.matches[0][0]).toEqual('-r requirements.txt');
    expect(res.matches[1][0]).toEqual('-r base.txt');
    expect(res).toMatchSnapshot();
  });

  it('with -c', async () => {
    const res = await containsRequireDirective('-c constraints.txt');
    expect(res).toMatchSnapshot();
    expect(res.matches[0][0]).toEqual('-c constraints.txt');
  });
  it('without -c', async () => {
    const res = await containsRequireDirective('Jinja2==1.2.3\nDjango==4.5.6');
    expect(res).toEqual({
      containsRequire: false,
      matches: [],
    });
  });

  it('with -r & -c', async () => {
    const res = await containsRequireDirective(
      '-c constraints.txt\n-r base.txt',
    );
    expect(res.matches[0][0]).toEqual('-c constraints.txt');
    expect(res.matches[1][0]).toEqual('-r base.txt');
    expect(res).toMatchSnapshot();
  });

  it('with -r & -c after deps', async () => {
    const res = await containsRequireDirective(
      'Jinja2==1.2.3\nDjango==4.5.6\n-c constraints.txt\n-r base.txt',
    );
    expect(res.matches[0][0]).toEqual('-c constraints.txt');
    expect(res.matches[1][0]).toEqual('-r base.txt');
    expect(res).toMatchSnapshot();
  });
});
