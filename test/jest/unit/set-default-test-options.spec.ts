import { setDefaultTestOptions } from '../../../src/cli/commands/test/set-default-test-options';

describe('setDefaultTestOptions', () => {
  it('defaults to show-vulnerable-paths:some & org from config when no options passed in', () => {
    const updated = setDefaultTestOptions({ path: '/' });
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'some',
    });
  });

  it('with show-vulnerable-paths set to `false` => `none`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': 'false',
    };
    const updated = setDefaultTestOptions(options);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'none',
    });
  });

  it('with show-vulnerable-paths as boolean => `some`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': true,
    };
    const updated = setDefaultTestOptions(options as any);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'some',
    });
  });

  it('with show-vulnerable-paths set to `none` => `none`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': 'none',
    };
    const updated = setDefaultTestOptions(options);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'none',
    });
  });

  it('with show-vulnerable-paths set to `true` => `some`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': 'true',
    };
    const updated = setDefaultTestOptions(options);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'some',
    });
  });

  it('with show-vulnerable-paths set to `some` => `some`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': 'some',
    };
    const updated = setDefaultTestOptions(options);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'some',
    });
  });

  it('with show-vulnerable-paths set to `all` => `all`', () => {
    const options = {
      path: '/',
      'show-vulnerable-paths': 'all',
    };
    const updated = setDefaultTestOptions(options);
    expect(updated).toEqual({
      org: undefined,
      path: '/',
      showVulnPaths: 'all',
    });
  });

  it('with org set', () => {
    const updated = setDefaultTestOptions({ path: '/', org: 'my-org' });
    expect(updated).toEqual({
      org: 'my-org',
      path: '/',
      showVulnPaths: 'some',
    });
  });
});
