import { args } from '../../../../src/cli/args';

describe('CLI args vulnid parsing', () => {
  it('should parse single vulnid option', () => {
    const result = args(['node', 'snyk', 'fix', '--vulnid=SNYK-123']);
    expect(result.options.vulnid).toBe('SNYK-123');
  });

  it('should parse multiple vulnid options as array', () => {
    const result = args(['node', 'snyk', 'fix', '--vulnid=SNYK-123', '--vulnid=SNYK-456']);
    expect(result.options.vulnid).toEqual(['SNYK-123', 'SNYK-456']);
  });

  it('should parse multiple vulnid options with vuln-id syntax', () => {
    const result = args(['node', 'snyk', 'fix', '--vuln-id=SNYK-123', '--vuln-id=SNYK-456']);
    expect(result.options.vulnid).toEqual(['SNYK-123', 'SNYK-456']);
  });

  it('should parse mixed vulnid and vuln-id options', () => {
    const result = args(['node', 'snyk', 'fix', '--vulnid=SNYK-123', '--vuln-id=SNYK-456']);
    expect(result.options.vulnid).toEqual(['SNYK-123', 'SNYK-456']);
  });

  it('should handle no vulnid options', () => {
    const result = args(['node', 'snyk', 'fix']);
    expect(result.options.vulnid).toBeUndefined();
  });

  it('should transform vuln-id to vulnId in camelCase', () => {
    const result = args(['node', 'snyk', 'fix', '--vuln-id=SNYK-123']);
    expect(result.options.vulnId).toEqual('SNYK-123');
  });
});