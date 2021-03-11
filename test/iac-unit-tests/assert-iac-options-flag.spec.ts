import { IaCTestOptions } from '../../src/lib/types';
import { assertIaCOptionsFlags } from '../../src/cli/commands/test/iac-local-execution/assert-iac-options-flag';

describe('assertIaCOptionsFlags()', () => {
  const command = ['node', 'cli', 'iac', 'test'];
  const files = ['input.tf'];

  it('accepts all command line flags accepted by the iac command', () => {
    const options = [
      '--debug',
      '--insecure',
      '--experimental',
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
});
