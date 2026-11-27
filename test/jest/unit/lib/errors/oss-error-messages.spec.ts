import { UnsupportedPackageManagerError } from '../../../../../src/lib/errors/unsupported-package-manager-error';
import { JsonFileOutputBadInputError } from '../../../../../src/lib/errors/json-file-output-bad-input-error';
import { SarifFileOutputEmptyError } from '../../../../../src/lib/errors/empty-sarif-output-error';

describe('UnsupportedPackageManagerError', () => {
  it('quotes the offending value once', () => {
    const err = new UnsupportedPackageManagerError('hello');
    expect(err.userMessage).toContain("Unsupported package manager 'hello'.");
    expect(err.userMessage).not.toContain("''");
    expect(err.message).toBe(err.userMessage);
  });

  it('lists supported package managers one per line without array commas', () => {
    const err = new UnsupportedPackageManagerError('hello');
    expect(err.userMessage).toContain(
      'Here are our supported package managers:\n  - rubygems (RubyGems)\n  - npm (npm)\n',
    );
    expect(err.userMessage).not.toMatch(/,\s*\n\s+- /);
    expect(err.userMessage).not.toContain(':,');
  });

  it('keeps the error code', () => {
    expect(new UnsupportedPackageManagerError('x').code).toBe(422);
  });
});

describe('output file flag errors', () => {
  it('--json-file-output suggests the correct flag', () => {
    const err = new JsonFileOutputBadInputError();
    expect(err.userMessage).toBe(
      'Empty --json-file-output argument. Did you mean --json-file-output=path/to/output-file.json ?',
    );
    expect(err.code).toBe(422);
  });

  it('--sarif-file-output suggests the correct flag', () => {
    const err = new SarifFileOutputEmptyError();
    expect(err.userMessage).toBe(
      'Empty --sarif-file-output argument. Did you mean --sarif-file-output=path/to/output-file.sarif ?',
    );
    expect(err.code).toBe(422);
  });
});
