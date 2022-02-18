import { ArgsOptions } from '../../../src/cli/args';
import { getQueryParamsAsString } from '../../../src/lib/query-strings';

describe('getQueryParamsAsString', () => {
  it('returns a string', () => {
    expect(typeof getQueryParamsAsString([])).toBe('string');
  });

  it("returns a string that's a valid URL query string", () => {
    expect(
      Array.from(new URLSearchParams(getQueryParamsAsString([])).entries()),
    ).toEqual([
      ['utm_medium', 'cli'],
      ['utm_source', 'cli'],
      ['utm_campaign', 'cli'],
      ['os', expect.any(String)],
      ['docker', expect.any(String)],
    ]);
  });

  it('uses integration name and version', () => {
    const args = createArgs({
      integrationName: 'JENKINS',
      integrationVersion: '1.2.3',
    });
    expect(
      Array.from(new URLSearchParams(getQueryParamsAsString(args)).entries()),
    ).toEqual([
      ['utm_medium', 'cli'],
      ['utm_source', 'cli'],
      ['utm_campaign', 'JENKINS'],
      ['utm_campaign_content', '1.2.3'],
      ['os', expect.any(String)],
      ['docker', expect.any(String)],
    ]);
  });

  const createArgs = (args: Partial<ArgsOptions>): ArgsOptions[] => {
    return [
      {
        ...args,
        _: [],
        rawArgv: [],
        _doubleDashArgs: [],
      },
    ];
  };
});
