import { getSkipTestList } from '../util/getSkipTestList';

describe('getSkipTestList (TEST_SNYK_IGNORE_LIST)', () => {
  it('returns empty partitions for undefined', () => {
    expect(getSkipTestList(undefined)).toEqual({
      valid: [],
      invalid: [],
    });
  });

  it('returns empty partitions for whitespace-only', () => {
    expect(getSkipTestList('   ')).toEqual({ valid: [], invalid: [] });
  });

  it('classifies valid RegExp sources', () => {
    expect(getSkipTestList('foo, bar\\.ts ')).toEqual({
      valid: ['foo', 'bar\\.ts'],
      invalid: [],
    });
  });

  it('splits on comma, trims, drops empty segments', () => {
    expect(getSkipTestList(' x , , y ')).toEqual({
      valid: ['x', 'y'],
      invalid: [],
    });
  });

  it('rejects invalid RegExp sources', () => {
    expect(getSkipTestList('[bad')).toEqual({
      valid: [],
      invalid: ['[bad'],
    });
  });

  it('partitions when list mixes valid and invalid', () => {
    expect(getSkipTestList('ok-ignore-part,[bad')).toEqual({
      valid: ['ok-ignore-part'],
      invalid: ['[bad'],
    });
  });
});
