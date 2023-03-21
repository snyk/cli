import getWoof from '../../../src/cli/commands/woof/getWoof';

describe('Woof command - Language option', () => {
  it('Default language is "en"', () => {
    // $ snyk woof
    expect(getWoof([{} as any])).toEqual('Woof!');
  });

  it('Returns selected language', () => {
    expect(
      getWoof([
        {
          language: 'he',
        } as any,
      ]),
    ).toEqual(' בה! ');
  });

  it('Returns default when selected language is invalid', () => {
    expect(
      getWoof([
        {
          language: 'toString',
        } as any,
      ]),
    ).toEqual('Woof!');
  });
});
