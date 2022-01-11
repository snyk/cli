import { deQuote } from '../../src/lib/utils';

describe('deQuote', () => {
  it('removes single quotes', () => {
    expect(deQuote("'abc123'")).toBe('abc123');
  });

  it('removes double quotes', () => {
    expect(deQuote('"abc123"')).toBe('abc123');
  });
});
