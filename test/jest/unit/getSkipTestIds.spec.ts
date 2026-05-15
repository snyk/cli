import { getSkipTestIds } from '../util/getSkipTestIds';

describe('getSkipTestIds', () => {
  it('returns empty array for undefined', () => {
    expect(getSkipTestIds(undefined)).toEqual([]);
  });

  it('returns empty array for whitespace-only', () => {
    expect(getSkipTestIds('   \t')).toEqual([]);
  });

  it('splits on comma, trims, drops empty segments', () => {
    expect(getSkipTestIds(' a , , b ,')).toEqual(['a', 'b']);
  });
});
