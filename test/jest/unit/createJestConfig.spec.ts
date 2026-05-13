describe('createJestConfig (TEST_SNYK_IGNORE_LIST)', () => {
  afterEach(() => {
    delete process.env.TEST_SNYK_IGNORE_LIST;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function loadCreateJestConfig(envValue: string | undefined) {
    if (envValue === undefined) {
      delete process.env.TEST_SNYK_IGNORE_LIST;
    } else {
      process.env.TEST_SNYK_IGNORE_LIST = envValue;
    }
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../createJestConfig').createJestConfig as (config?: object) => {
      testPathIgnorePatterns: string[];
    };
  }

  it('no TEST_SNYK_IGNORE_LIST: no stderr banner, base paths preserved', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const createJestConfig = loadCreateJestConfig(undefined);
    const cfg = createJestConfig({});
    expect(cfg.testPathIgnorePatterns).toContain('/node_modules/');
    expect(warn).not.toHaveBeenCalled();
  });

  it('empty TEST_SNYK_IGNORE_LIST after trim: no banner', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const createJestConfig = loadCreateJestConfig('   ');
    createJestConfig({});
    expect(warn).not.toHaveBeenCalled();
  });

  it('non-empty list: warn includes fragments and merges into testPathIgnorePatterns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const createJestConfig = loadCreateJestConfig('foo, bar ,,, baz ');
    const cfg = createJestConfig({});
    expect(warn.mock.calls[0]?.[1]).toEqual(['foo', 'bar', 'baz']);
    expect(cfg.testPathIgnorePatterns).toEqual(
      expect.arrayContaining(['foo', 'bar', 'baz', '/node_modules/']),
    );
  });

  it('caller testPathIgnorePatterns merge after env fragments, not overwriting base', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const createJestConfig = loadCreateJestConfig('from-env');
    const cfg = createJestConfig({
      testPathIgnorePatterns: ['/caller-only/'],
    });
    const paths = cfg.testPathIgnorePatterns;
    const idxBase = paths.indexOf('/node_modules/');
    const idxEnv = paths.indexOf('from-env');
    const idxCaller = paths.indexOf('/caller-only/');
    expect(idxBase).not.toBe(-1);
    expect(idxEnv).not.toBe(-1);
    expect(idxCaller).not.toBe(-1);
    expect(idxBase).toBeLessThan(idxEnv);
    expect(idxEnv).toBeLessThan(idxCaller);
  });
});
