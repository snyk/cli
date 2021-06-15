import * as fs from 'fs';
import * as path from 'path';
import stripAnsi from 'strip-ansi';

const DEFAULT_HELP = 'snyk';

function readHelpFile(filename: string): string {
  const file = fs.readFileSync(filename, 'utf8');
  if (typeof process.env.NO_COLOR !== 'undefined' || !process.stdout.isTTY) {
    return stripAnsi(file);
  }
  return file;
}

export = async function help(item: string | boolean) {
  if (!item || item === true || typeof item !== 'string' || item === 'help') {
    item = DEFAULT_HELP;
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  item = item.replace(/[^a-z-]/gi, '');

  try {
    const filename = path.resolve(
      __dirname,
      '../../../help/commands-docs',
      item === DEFAULT_HELP ? DEFAULT_HELP + '.txt' : `snyk-${item}.txt`,
    );
    return readHelpFile(filename);
  } catch (error) {
    const filename = path.resolve(
      __dirname,
      '../../../help/commands-docs',
      DEFAULT_HELP + '.txt',
    );
    return readHelpFile(filename);
  }
};
