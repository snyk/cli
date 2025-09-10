import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(20 * 1000);

describe('woof', () => {
  // supported languages
  const languages = [
    { langCode: 'en', expectedWoof: 'Woof!' },
    { langCode: 'he', expectedWoof: 'בה! ' },
    { langCode: 'ru', expectedWoof: 'Гав!' },
    { langCode: 'es', expectedWoof: 'Guau!' },
    { langCode: 'cs', expectedWoof: 'Haf!' },
    { langCode: 'uk', expectedWoof: 'Гав!' },
    { langCode: 'de', expectedWoof: 'Wuff!' },
    { langCode: 'ro', expectedWoof: 'Ham!' },
    { langCode: 'cat', expectedWoof: 'Meow?' },
  ];

  // test default
  it('Woofs in English by default', async () => {
    const { stdout, code, stderr } = await runSnykCLI(`woof`);
    expect(stdout).toContain('Woof!');
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  // test unsuported
  it('Woofs in English when passed unsupported language', async () => {
    const { stdout, stderr, code } = await runSnykCLI(
      `woof --language=blalbla`,
    );
    expect(stdout).toContain('Woof!');
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  // test each supported language code
  test.concurrent.each(languages)(
    'Woofs in %s',
    async ({ langCode, expectedWoof }) => {
      const { stdout, code, stderr } = await runSnykCLI(
        `woof --language=${langCode}`,
      );
      expect(stdout).toContain(expectedWoof);
      expect(code).toBe(0);
      expect(stderr).toBe('');
    },
  );
});
