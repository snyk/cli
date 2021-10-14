import { generateTags } from '../../../../src/cli/commands/monitor/index';

describe('--tags', () => {
  it('raises the correct error when passed as --project-tags (i.e. missing the =)', () => {
    expect(() => generateTags({ 'project-tags': true })).toThrow(
      /must contain.*comma-separated/,
    );
  });

  it('returns an empty set of tags when passed as --project-tags=', () => {
    expect(generateTags({ 'project-tags': '' })).toStrictEqual([]);
  });

  it('returns undefined when --project-tags is not passed', () => {
    expect(generateTags({ someOtherArg: true })).toBeUndefined();
  });

  it('raises the correct error when a key is supplied with no value', () => {
    expect(() =>
      generateTags({ 'project-tags': 'invalidAsOnlyAKeyWasSpecified' }),
    ).toThrow(/does not have an "="/);
  });

  it('parses a single key/value pair into the correct data structure', () => {
    expect(generateTags({ 'project-tags': 'team=rhino' })).toStrictEqual([
      {
        key: 'team',
        value: 'rhino',
      },
    ]);
  });

  it('parses multiple key/value pairs into the correct data structure', () => {
    expect(
      generateTags({ 'project-tags': 'team=rhino,department=finance' }),
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
