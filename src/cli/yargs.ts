import yargs from 'yargs';

export const argv = yargs(process.argv.slice(2)).command(
  'woof',
  'Count the lines in a file',
);
