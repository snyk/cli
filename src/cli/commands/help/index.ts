import * as fs from 'fs';
import * as path from 'path';
import { renderMarkdown } from './markdown-renderer';
import { ArgsOptions, MethodArgs } from '../../args';

const DEFAULT_HELP = 'README';

function readHelpFile(filename: string): string {
  const file = fs.readFileSync(filename, 'utf8');
  return renderMarkdown(file);
}

// This function is a workaround to get the absolute path
// of the project for both CLI and unit tests.
export function getProjectAbsolutePath(): string {
  const filepath = path.dirname(__filename);
  if (filepath.indexOf('dist') > -1) {
    return path.join(filepath, '../../');
  }
  // Jest tests aren't transpiled, so the current filepath
  // is the TS file, not the transpiled JS file.
  return path.join(filepath, '../../../../');
}

export function getHelpFilePath(argv: string[]): string {
  let item: string = DEFAULT_HELP;
  while (argv.length) {
    if (argv[0] === 'help') {
      argv.shift();
    }
    const docFile = argv.join('-');
    argv.pop();
    const filename = path.resolve(
      getProjectAbsolutePath(),
      'help/cli-commands',
      `${docFile}.md`,
    );
    if (!fs.existsSync(filename)) {
      continue;
    }
    item = docFile;
    break;
  }

  // cleanse the filename to only contain letters
  // aka: /\W/g but figured this was easier to read
  item = item.replace(/[^a-z0-9-]/gi, '');

  return path.resolve(
    getProjectAbsolutePath(),
    'help/cli-commands',
    `${item}.md`,
  );
}

export default async function help(...args: MethodArgs): Promise<string> {
  let rawArgv: string[] | MethodArgs = args;
  if (args.length > 1) {
    rawArgv = (args.pop() as ArgsOptions).rawArgv;
  }
  const formattedArgv = getSubcommandWithoutFlags(rawArgv as string[]);
  return readHelpFile(getHelpFilePath(formattedArgv));
}

export function getSubcommandWithoutFlags(argv: string[]): string[] {
  const formattedArgv: string[] = [];
  if (!argv) {
    return formattedArgv;
  }
  for (const arg of argv) {
    if (
      arg.indexOf('-') === 0 ||
      arg.indexOf('/') > -1 ||
      arg.indexOf('.') > -1
    ) {
      continue;
    }
    formattedArgv.push(arg);
  }
  return formattedArgv;
}
