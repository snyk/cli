import { CommandBuilder } from 'yargs';
import { woofs } from './woofs';

// GlobalOptions comes from yargs' generic defaults
// eslint-disable-next-line @typescript-eslint/ban-types
export type GlobalOptions = Omit<{}, keyof string[]>;

export type WoofOptions = {
  language: keyof typeof woofs;
};

export const builder: CommandBuilder<GlobalOptions, WoofOptions> = {
  language: {
    describe: 'Patch knows many languages.',
    default: 'en',
    choices: Object.keys(woofs),
  },
};
