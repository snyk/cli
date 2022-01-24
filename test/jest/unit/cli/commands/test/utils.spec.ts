import { getPathWithOptionalProjectName } from '../../../../../../src/cli/commands/test/utils';

describe('getPathWithOptionalProjectName', () => {
  test.each([
    {
      projectName: '',
    },
    {
      projectName: 'anything',
    },
  ])('returns given path', () => {
    const result = getPathWithOptionalProjectName('/tmp/hydra', {
      projectName: '',
    });
    expect(result).toEqual('/tmp/hydra');
  });

  test('appends subdirectory from project name', () => {
    const result = getPathWithOptionalProjectName('/tmp/hydra', {
      projectName: 'anything/subdir',
    });
    expect(result).toEqual('/tmp/hydra/subdir');
  });
});
