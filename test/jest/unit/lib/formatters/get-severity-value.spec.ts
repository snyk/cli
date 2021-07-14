import { getSeverityValue } from '../../../../../src/lib/formatters/get-severity-value';
import { SEVERITY } from '../../../../../src/lib/snyk-test/common';

describe('getSeverityValue', () => {
  it('Critical returns 1', () => {
    expect(getSeverityValue(SEVERITY.CRITICAL)).toEqual(4);
  });
  it('High returns 2', () => {
    expect(getSeverityValue(SEVERITY.HIGH)).toEqual(3);
  });
  it('Medium returns 3', () => {
    expect(getSeverityValue(SEVERITY.MEDIUM)).toEqual(2);
  });
  it('Low returns 4', () => {
    expect(getSeverityValue(SEVERITY.LOW)).toEqual(1);
  });
});
