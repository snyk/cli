import { colorTextBySeverity } from '../../../src/lib/snyk-test/common';
import { color } from '../../../src/lib/theme';
import { SEVERITY } from '../../../src/lib/snyk-test/common';

describe('colorTextBySeverity', () => {
  it('Returns a high severity colored text', () => {
    const severity = SEVERITY.HIGH;
    expect(colorTextBySeverity(severity, 'Pls help me')).toEqual(
      color.severity[severity]('Pls help me'),
    );
  });

  it('Pass an empty string as text', () => {
    const severity = SEVERITY.HIGH;
    expect(colorTextBySeverity(severity, '')).toEqual(
      color.severity[severity](''),
    );
  });

  it('Pass an empty string as severity', () => {
    const severity = '';
    const defaultSeverity = SEVERITY.LOW;
    expect(colorTextBySeverity(severity, 'Pls help me')).toEqual(
      color.severity[defaultSeverity]('Pls help me'),
    );
  });

  it('Set default low color when given a nonexistent severity', () => {
    const severity = 'nonExistentSeverity';
    const defaultSeverity = SEVERITY.LOW;
    expect(colorTextBySeverity(severity, 'Pls help me')).toEqual(
      color.severity[defaultSeverity]('Pls help me'),
    );
  });

  it('Pass an upper case string as severity', () => {
    const severity = 'HIGH';
    const lowerCaseSeverity = SEVERITY.HIGH;
    expect(colorTextBySeverity(severity, 'Pls help me')).toEqual(
      color.severity[lowerCaseSeverity]('Pls help me'),
    );
  });
});
