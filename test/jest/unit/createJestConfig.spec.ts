describe('createJestConfig (TEST_SNYK_IGNORE_LIST)', () => {
  afterEach(() => {
    delete process.env.TEST_SNYK_IGNORE_LIST;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  function unsetTestSnykIgnoreListEnv(): void {
    delete process.env.TEST_SNYK_IGNORE_LIST;
  }

  function setTestSnykIgnoreListEnv(value: string): void {
    process.env.TEST_SNYK_IGNORE_LIST = value;
  }

  /**
   * Loads `createJestConfig` from disk after `jest.resetModules()` so the module’s
   * `ignoreFragmentsWarned` flag (and any other module state in `test/createJestConfig.js`)
   * matches this test case.
   */
  function loadFreshCreateJestConfig(): (config?: object) => {
    testPathIgnorePatterns: string[];
  } {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../createJestConfig').createJestConfig as (
      config?: object,
    ) => {
      testPathIgnorePatterns: string[];
    };
  }

  it('when TEST_SNYK_IGNORE_LIST is unset: base ignore patterns still apply and no [acceptance ignore] warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    unsetTestSnykIgnoreListEnv();
    const createJestConfig = loadFreshCreateJestConfig();
    const cfg = createJestConfig({});
    expect(cfg.testPathIgnorePatterns).toContain('/node_modules/');
    expect(warn).not.toHaveBeenCalled();
  });

  it('empty TEST_SNYK_IGNORE_LIST after trim: no banner', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('   ');
    const createJestConfig = loadFreshCreateJestConfig();
    createJestConfig({});
    expect(warn).not.toHaveBeenCalled();
  });

  it('non-empty list: warn includes fragments and merges into testPathIgnorePatterns', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('foo, bar ,,, baz ');
    const createJestConfig = loadFreshCreateJestConfig();
    const cfg = createJestConfig({});
    expect(warn.mock.calls[0]?.[1]).toEqual(['foo', 'bar', 'baz']);
    expect(cfg.testPathIgnorePatterns).toEqual(
      expect.arrayContaining(['foo', 'bar', 'baz', '/node_modules/']),
    );
  });

  it('warns at most once when createJestConfig is invoked repeatedly', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('same-env');
    const createJestConfig = loadFreshCreateJestConfig();
    createJestConfig({});
    createJestConfig({});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toEqual(['same-env']);
  });

  it('skips fragments that are invalid RegExp sources and does not merge them', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('[bad');
    const createJestConfig = loadFreshCreateJestConfig();
    const cfg = createJestConfig({});
    expect(cfg.testPathIgnorePatterns).not.toContain('[bad');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toContain('Skipping invalid');
    expect(warn.mock.calls[0]?.[2]).toEqual(['[bad']);
  });

  it('merges only valid fragments when the list mixes valid and invalid entries', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('ok-ignore-part,[bad');
    const createJestConfig = loadFreshCreateJestConfig();
    const cfg = createJestConfig({});
    expect(cfg.testPathIgnorePatterns).toContain('ok-ignore-part');
    expect(cfg.testPathIgnorePatterns).not.toContain('[bad');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[1]).toContain('Skipping invalid');
    expect(warn.mock.calls[0]?.[2]).toEqual(['[bad']);
    expect(warn.mock.calls[1]?.[1]).toEqual(['ok-ignore-part']);
  });

  it('caller testPathIgnorePatterns merge after env fragments, not overwriting base', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    setTestSnykIgnoreListEnv('from-env');
    const createJestConfig = loadFreshCreateJestConfig();
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
