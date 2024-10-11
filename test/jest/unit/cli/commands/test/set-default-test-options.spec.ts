import { setDefaultTestOptions } from '../../../../../../src/cli/commands/test/set-default-test-options';

describe('setDefaultTestOptions', () => {
  it('default options', () => {
    const options = {};
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('some');
    expect(result.maxVulnPaths).toBeUndefined();
  });

  it('explicit max-vulnerable-paths', () => {
    const options = { 'max-vulnerable-paths': 42 };
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('some');
    expect(result.maxVulnPaths).toEqual(42);
  });

  it('explicit show-vulnerable-paths', () => {
    const options = { 'show-vulnerable-paths': 'all' };
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('all');
    expect(result.maxVulnPaths).toBeUndefined();
  });
});
