import { Options } from '../../lib/types';

export function processCommandArgs<CommandOptions>(
  ...args
): { paths: string[]; options: Options & CommandOptions } {
  let options = ({} as any) as Options & CommandOptions;

  if (typeof args[args.length - 1] === 'object') {
    options = (args.pop() as any) as Options & CommandOptions;
  }
  args = args.filter(Boolean);

  // populate with default path (cwd) if no path given
  if (args.length === 0) {
    args.unshift(process.cwd());
  }

  return { options, paths: args };
}
