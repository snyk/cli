import * as fs from 'fs';
import * as path from 'path';
import * as Debug from 'debug';
const debug = Debug('snyk');

export = async function help(item: string | boolean) {
  if (!item || item === true || typeof item !== 'string') {
    item = 'help';
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  item = item.replace(/[^a-z-]/gi, '');

  const filename = path.resolve(__dirname, '../../../help', item + '.txt');
  try {
    return fs.readFileSync(filename, 'utf8');
  } catch (error) {
    debug(error);
    return `'${item}' help can't be found at location: ${filename}`;
  }
};
