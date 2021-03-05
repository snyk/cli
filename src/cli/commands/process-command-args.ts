import { Options } from '../../lib/types';
import { ArgsOptions } from '../args';

export function processCommandArgs<CommandOptions>(
  ...args
): { paths: string[]; options: Options & CommandOptions } {
  let commandOptions = {};

  if (typeof args[args.length - 1] === 'object') {
    commandOptions = (args.pop() as any) as ArgsOptions;
  }
  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length === 0) {
    args.unshift(process.cwd());
  }
  const options = commandOptions as Options & CommandOptions;

  return { options, paths: args };
}
