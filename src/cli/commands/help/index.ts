import * as fs from 'fs';
import * as path from 'path';
import { renderMarkdown } from './markdown-renderer';

const DEFAULT_HELP = 'README';

function readHelpFile(filename: string): string {
  const file = fs.readFileSync(filename, 'utf8');
  return renderMarkdown(file);
}

export default async function help(item?: string | boolean): Promise<string> {
  if (!item || item === true || typeof item !== 'string' || item === 'help') {
    item = DEFAULT_HELP;
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  item = item.replace(/[^a-z0-9-]/gi, '');

  try {
    const filename = path.resolve(
      __dirname,
      '../../help/cli-commands', // this is a relative path from the webpack dist directory
      item === DEFAULT_HELP ? `${DEFAULT_HELP}.md` : `${item}.md`,
    );
    return readHelpFile(filename);
  } catch (error) {
    const filename = path.resolve(
      __dirname,
      '../../help/cli-commands',
      `${DEFAULT_HELP}.md`,
    );
    return readHelpFile(filename);
  }
}
