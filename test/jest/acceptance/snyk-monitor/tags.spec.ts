import { generateTags } from '../../../../src/cli/commands/monitor/index';

describe('--tags', () => {
  it('raises the correct error when passed as --tags (i.e. missing the =)', () => {
    expect(() => generateTags({ tags: true })).toThrow(
      /must contain.*comma-separated/,
    );
  });

  it('returns an empty set of tags when passed as --tags=', () => {
    expect(generateTags({ tags: '' })).toStrictEqual([]);
  });

  it('returns undefined when --tags is not passed', () => {
    expect(generateTags({ someOtherArg: true })).toBeUndefined();
  });

  it('raises the correct error when a key is supplied with no value', () => {
    expect(() =>
      generateTags({ tags: 'invalidAsOnlyAKeyWasSpecified' }),
    ).toThrow(/does not have an "="/);
  });

  it('parses a single key/value pair into the correct data structure', () => {
    expect(generateTags({ tags: 'team=rhino' })).toStrictEqual([
      {
        key: 'team',
        value: 'rhino',
      },
    ]);
  });

  it('parses multiple key/value pairs into the correct data structure', () => {
    expect(
      generateTags({ tags: 'team=rhino,department=finance' }),
    ).toStrictEqual([
      {
        key: 'team',
        value: 'rhino',
      },
      {
        key: 'department',
        value: 'finance',
      },
    ]);
  });
});
