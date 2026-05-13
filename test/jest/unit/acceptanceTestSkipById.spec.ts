describe('acceptanceTestSkipById (TEST_SNYK_SKIP_TEST_IDS)', () => {
  afterEach(() => {
    delete process.env.TEST_SNYK_SKIP_TEST_IDS;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  async function loadModule() {
    jest.resetModules();
    return import('../util/acceptanceTestSkipById');
  }

  it('returns global `it` when TEST_SNYK_SKIP_TEST_IDS is unset', async () => {
    delete process.env.TEST_SNYK_SKIP_TEST_IDS;
    const { acceptanceIt } = await loadModule();
    expect(acceptanceIt('any-stable-id')).toBe(it);
  });

  it('returns global `it` when TEST_SNYK_SKIP_TEST_IDS is empty or whitespace-only', async () => {
    process.env.TEST_SNYK_SKIP_TEST_IDS = '   ';
    const { acceptanceIt } = await loadModule();
    expect(acceptanceIt('any-stable-id')).toBe(it);
  });

  it('returns `it.skip` when the id is listed', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TEST_SNYK_SKIP_TEST_IDS = 'stable-id-one';
    const { acceptanceIt } = await loadModule();
    expect(acceptanceIt('stable-id-one')).toBe(it.skip);
    expect(acceptanceIt('other-id')).toBe(it);
  });

  it('parses comma-separated ids with trimming and ignores empty segments', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TEST_SNYK_SKIP_TEST_IDS = ' a , , b ';
    const { acceptanceIt } = await loadModule();
    expect(acceptanceIt('a')).toBe(it.skip);
    expect(acceptanceIt('b')).toBe(it.skip);
    expect(acceptanceIt('c')).toBe(it);
  });

  it('logs [acceptance skip tests] once per module load when ids are present', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TEST_SNYK_SKIP_TEST_IDS = 'x,y';
    const { acceptanceIt } = await loadModule();
    acceptanceIt('x');
    acceptanceIt('y');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('[acceptance skip tests]');
    expect(warn.mock.calls[0][1]).toEqual(['x', 'y']);
  });

  it('exports documented stable id constants for the Snyk Code user journey', async () => {
    const { SnykCodeUserJourneyContextSkipIds } = await loadModule();
    expect(SnykCodeUserJourneyContextSkipIds.GOLANG_NATIVE_IGNORED_ISSUES_SEVERITY_THRESHOLD).toBe(
      'snyk-code-user-journey:golang-native:ignored-issues:severity-threshold',
    );
    expect(SnykCodeUserJourneyContextSkipIds.GOLANG_NATIVE_IGNORED_ISSUES_INCLUDE_IGNORES).toBe(
      'snyk-code-user-journey:golang-native:ignored-issues:include-ignores',
    );
    expect(SnykCodeUserJourneyContextSkipIds.GOLANG_NATIVE_IGNORED_ISSUES_SINGLE_FILE).toBe(
      'snyk-code-user-journey:golang-native:ignored-issues:single-file',
    );
  });
});
