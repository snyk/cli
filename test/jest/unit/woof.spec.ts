import getWoof from '../../../src/cli/commands/woof/getWoof';

describe('Woof command - Language option', () => {
  it('Default language is "en"', () => {
    // $ snyk woof
    expect(getWoof({})).toEqual('Woof!');
  });

  it('Returns selected language', () => {
    expect(
      getWoof({
        language: 'he',
      }),
    ).toEqual(' !הב ');
  });

  it('Returns default when selected language is invalid', () => {
    expect(
      getWoof({
        language: 'toString',
      }),
    ).toEqual('Woof!');
  });
});
