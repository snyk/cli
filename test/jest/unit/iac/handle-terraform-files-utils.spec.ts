import {
  getExtensionForPath,
  shouldBeParsed,
} from '../../../../src/cli/commands/test/iac-local-execution/handle-terraform-files-utils';

describe('handle-terraform-files-utils', () => {
  describe('getExtensionForPath and shouldBeParsed', () => {
    it.each([
      ['dir/file1.tf', '.tf', true],
      ['dir/file2.yaml', '.yaml', false],
      ['dir/.', '', false],
      ['dir/..', '', false],
      ['dir/.DS_Store', '', false],
      ['dir/#', '', false],
      ['dir/#swap#', '', false],
      ['dir/~', '', false],
      ['dir/~something', '', false],
      ['dir/file.tfvars', '.tfvars', true],
      ['dir/file.auto.tfvars', '.tfvars', true],
    ])(
      'given %p filepath, returns %p as expectedExtension and %p for shouldBeParsed',
      (filepath, expectedExtension, expectedResult) => {
        expect(getExtensionForPath(filepath)).toBe(expectedExtension);
        expect(shouldBeParsed(filepath)).toBe(expectedResult);
      },
    );
  });
});
