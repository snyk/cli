import * as fs from 'fs';
import * as path from 'path';
import { MethodArgs } from '../../args';
import { renderMarkdown } from './markdown-renderer';

export function findHelpFile(
  helpArgs: string[],
  helpFolderPath = '../../help/cli-commands', // this is a relative path from the webpack dist directory,
): string {
  let helpArgsSubFolders = helpArgs.slice();
  let subFolder = '';
  while (helpArgs.length > 0) {
    // cleanse the filename to only contain letters
    // aka: /\W/g but figured this was easier to read
    const file = `${helpArgs.join('-').replace(/[^a-z0-9-]/gi, '')}.md`;
    const testHelpAbsolutePath = path.resolve(__dirname, helpFolderPath, file);

    const fileInSubFolders = `${helpArgsSubFolders
      .join('-')
      .replace(/[^a-z0-9-]/gi, '')}.md`;
    const testHelpAbsolutePathInSubFolders = path.resolve(
      __dirname,
      helpFolderPath,
      subFolder,
      fileInSubFolders,
    );

    if (fs.existsSync(testHelpAbsolutePath)) {
      return testHelpAbsolutePath;
    } else if (fs.existsSync(testHelpAbsolutePathInSubFolders)) {
      return testHelpAbsolutePathInSubFolders;
    }

    subFolder = subFolder + helpArgsSubFolders[0] + '/';
    helpArgsSubFolders = helpArgsSubFolders.slice(1);
    helpArgs = helpArgs.slice(0, -1);
  }
  return path.resolve(__dirname, helpFolderPath, `README.md`); // Default help file
}

export default async function help(...args: MethodArgs): Promise<string> {
  const helpArgs = args.filter((arg): arg is string => typeof arg === 'string');
  const helpFileAbsolutePath = findHelpFile(helpArgs);
  return renderMarkdown(fs.readFileSync(helpFileAbsolutePath, 'utf8'));
}
