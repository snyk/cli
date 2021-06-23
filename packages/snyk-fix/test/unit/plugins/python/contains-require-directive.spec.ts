import { containsRequireDirective } from '../../../../src/plugins/python/handlers/pip-requirements/contains-require-directive';

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
