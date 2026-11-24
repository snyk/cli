import { UnsupportedPackageManagerError } from '../../../../../src/lib/errors/unsupported-package-manager-error';
import { JsonFileOutputBadInputError } from '../../../../../src/lib/errors/json-file-output-bad-input-error';
import { SarifFileOutputEmptyError } from '../../../../../src/lib/errors/empty-sarif-output-error';
import { SUPPORTED_PACKAGE_MANAGER_NAME } from '../../../../../src/lib/package-managers';

describe('OSS error message wording', () => {
  it('UnsupportedPackageManagerError has no stray quote or commas in the list', () => {
    const error = new UnsupportedPackageManagerError('hello');
    const expectedList = Object.keys(SUPPORTED_PACKAGE_MANAGER_NAME)
      .map((name) => `\n  - ${name} (${SUPPORTED_PACKAGE_MANAGER_NAME[name]})`)
      .join('');
    const expected =
      `Unsupported package manager 'hello'. Here are our supported package managers:` +
      expectedList;

    expect(error.message).toBe(expected);
    expect(error.userMessage).toBe(expected);
    expect(error.message).not.toContain("''");
    expect(error.message).not.toMatch(/managers:,/);
    expect(error.message).not.toMatch(/\),\n/);
  });

  it('JsonFileOutputBadInputError suggests --json-file-output', () => {
    const error = new JsonFileOutputBadInputError();
    const expected =
      'Empty --json-file-output argument. Did you mean --json-file-output=path/to/output-file.json ?';

    expect(error.message).toBe(expected);
    expect(error.userMessage).toBe(expected);
  });

  it('SarifFileOutputEmptyError suggests --sarif-file-output with .sarif', () => {
    const error = new SarifFileOutputEmptyError();
    const expected =
      'Empty --sarif-file-output argument. Did you mean --sarif-file-output=path/to/output-file.sarif ?';

    expect(error.message).toBe(expected);
    expect(error.userMessage).toBe(expected);
  });
});
