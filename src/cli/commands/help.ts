import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_HELP = 'snyk';

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
      '../../../help/commands-txt',
      item === DEFAULT_HELP ? DEFAULT_HELP + '.txt' : `snyk-${item}.txt`,
    );
    return fs.readFileSync(filename, 'utf8');
  } catch (error) {
    const filename = path.resolve(
      __dirname,
      '../../../help/commands-txt',
      DEFAULT_HELP + '.txt',
    );
    return fs.readFileSync(filename, 'utf8');
  }
};
