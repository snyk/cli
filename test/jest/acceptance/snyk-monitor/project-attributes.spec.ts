import { generateProjectAttributes } from '../../../../src/cli/commands/monitor';
import {
  PROJECT_CRITICALITY,
  PROJECT_ENVIRONMENT,
  PROJECT_LIFECYCLE,
} from '../../../../src/lib/types';

describe('project attributes (--lifecycle, --environment, --business-criticality)', () => {
  it('returns undefined when they are all missing, for each option', () => {
    expect(generateProjectAttributes({})).toStrictEqual({
      criticality: undefined,
      lifecycle: undefined,
      environment: undefined,
    });
  });

  it('parses the options correctly when they are valid', () => {
    expect(
      generateProjectAttributes({
        'business-criticality': 'critical,high',
        lifecycle: 'development,sandbox',
        environment: 'backend,frontend',
      }),
    ).toStrictEqual({
      criticality: [PROJECT_CRITICALITY.CRITICAL, PROJECT_CRITICALITY.HIGH],
      lifecycle: [PROJECT_LIFECYCLE.DEVELOPMENT, PROJECT_LIFECYCLE.SANDBOX],
      environment: [PROJECT_ENVIRONMENT.BACKEND, PROJECT_ENVIRONMENT.FRONTEND],
    });
  });

  it('raises the correct error with an invalid business criticality', () => {
    expect(() =>
      generateProjectAttributes({ 'business-criticality': 'invalid' }),
    ).toThrow(
      '1 invalid business-criticality: invalid. Possible values are: critical, high, medium, low',
    );
  });

  it('raises the correct error with an invalid lifecycle', () => {
    expect(() => generateProjectAttributes({ lifecycle: 'invalid' })).toThrow(
      '1 invalid lifecycle: invalid. Possible values are: production, development, sandbox',
    );
  });

  it('raises the correct error with an invalid environment', () => {
    expect(() => generateProjectAttributes({ environment: 'invalid' })).toThrow(
      '1 invalid environment: invalid. Possible values are: frontend, backend, internal, external, mobile, saas, onprem, hosted, distributed',
    );
  });

  it('raises the correct error with multiple invalid attributes', () => {
    expect(() =>
      generateProjectAttributes({ lifecycle: 'invalid1,invalid2' }),
    ).toThrow(/2 invalid lifecycle: invalid1, invalid2/);
  });
});
