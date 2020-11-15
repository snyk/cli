import * as fs from 'fs';
import * as path from 'path';

export = async function help(item: string | boolean) {
  if (!item || item === true || typeof item !== 'string') {
    item = 'help';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  item = item.replace(/[^a-z-]/gi, '');

  if (!fs.existsSync(path.resolve(__dirname, '../../../help', item + '.txt'))) {
    item = 'help';
  }

  const filename = path.resolve(__dirname, '../../../help', item + '.txt');
  return fs.readFileSync(filename, 'utf8');
};
