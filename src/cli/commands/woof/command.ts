import { CommandModule } from 'yargs';
import { builder, GlobalOptions, WoofOptions } from './options';

export const command: CommandModule<GlobalOptions, WoofOptions> = {
  command: 'woof',
  describe: 'woof!',
  builder,
  handler: async (argv) => {
    (await import('./woof')).woof(argv);
  },
};
