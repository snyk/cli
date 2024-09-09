import { ArgsOptions } from '../../../../../src/cli/args';

/**
 * Test helper to make a proper ArgsOptions[] out of a simpler input.
 * @param args basic key value pairs object
 * @returns a ArgsOptions[] with just the stuff we need for the tests.
 */
export function argsFrom(args: { [key: string]: string }): ArgsOptions[] {
  const fullArgs = [
    {
      ...args,
    },
  ] as any as ArgsOptions[];
  return fullArgs;
}
