import {
  assertIaCOptionsFlags,
  FlagValueError,
} from '../../../../src/cli/commands/test/iac-local-execution/assert-iac-options-flag';

describe('assertIaCOptionsFlags()', () => {
  const command = ['node', 'cli', 'iac', 'test'];
  const files = ['input.tf'];

  it('accepts all command line flags accepted by the iac command', () => {
    const options = [
      '--debug',
      '--insecure',
      '--detection-depth',
      '--severity-threshold',
      '--json',
      '--sarif',
      '--json-file-output',
      '--sarif-file-output',
      '-v',
      '--version',
      '-h',
      '--help',
      '-q',
      '--quiet',
    ];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).not.toThrow();
  });

  it('accepts an empty options object', () => {
    expect(() => assertIaCOptionsFlags([...command, ...files])).not.toThrow();
  });

  it('throws an error if an unexpected flag is present', () => {
    const options = ['--project-name'];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).toThrow();
  });

  it('throws an error if a flag contains a typo', () => {
    const options = ['--experimenta'];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).toThrow();
  });

  describe('Terraform plan scan modes', () => {
    it('throws an error if the scan flag has no value', () => {
      const options = ['--scan'];
      expect(() =>
        assertIaCOptionsFlags([...command, ...options, ...files]),
      ).toThrow(FlagValueError);
    });

    it('throws an error if the scan flag has an unsupported value', () => {
      const options = ['--scan=rsrce-changes'];
      expect(() =>
        assertIaCOptionsFlags([...command, ...options, ...files]),
      ).toThrow(FlagValueError);
    });

    it.each([
      ['--scan=resource-changes', 'delta-scan'],
      ['--scan=planned-values', 'full-scan'],
    ])(
      'does not throw an error if the scan flag has a valid value of %s',
      (options) => {
        expect(() =>
          assertIaCOptionsFlags([...command, ...options, ...files]),
        ).not.toThrow(FlagValueError);
      },
    );
  });
});
