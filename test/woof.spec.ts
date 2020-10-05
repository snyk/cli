import { getWoofLanguage } from '../src/cli/commands/woof';

describe('Woof command - Language option', () => {
  it('Default language is "en"', () => {
    // $ snyk woof
    expect(getWoofLanguage([{} as any])).toEqual('en');
  });

  it('Returns selected language', () => {
    expect(
      getWoofLanguage([
        {
          language: 'he',
        } as any,
      ]),
    ).toEqual('he');
  });

  it('Returns default when selected language is invalid', () => {
    expect(
      getWoofLanguage([
        {
          language: 'toString',
        } as any,
      ]),
    ).toEqual('en');
  });
});
