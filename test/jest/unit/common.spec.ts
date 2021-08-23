import { colorTextBySeverity } from '../../../src/lib/snyk-test/common';
import { color } from '../../../src/lib/theme';
import { SEVERITY } from '../../../src/lib/snyk-test/common';

const ansiColorMap = {
  red: '\x1B[31m',
  yellow: '\x1B[33m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  default: '\x1b[39m',
};

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

  it('Set defaultive low color when given a non existent severity', () => {
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

  describe("Pass if text for each severity is colorized to it's matching escape code color", () => {
    it('Medium severity', () => {
      const severity = SEVERITY.MEDIUM;
      expect(colorTextBySeverity(severity, 'Pls help me')).toMatch(
        ansiColorMap.yellow + 'Pls help me' + ansiColorMap.default,
      );
    });
    it('High severity', () => {
      const severity = SEVERITY.HIGH;
      expect(colorTextBySeverity(severity, 'Pls help me')).toMatch(
        ansiColorMap.red + 'Pls help me' + ansiColorMap.default,
      );
    });
    it('Critical severity', () => {
      const severity = SEVERITY.CRITICAL;
      expect(colorTextBySeverity(severity, 'Pls help me')).toMatch(
        ansiColorMap.magenta + 'Pls help me' + ansiColorMap.default,
      );
    });
  });
});
