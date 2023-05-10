import * as fs from 'fs';
import * as path from 'path';
import { isIacDescribeDisabled } from '../../../lib/disabled-features';
import { MethodArgs } from '../../args';
import { renderMarkdown } from './markdown-renderer';

export function findHelpFile(
  helpArgs: string[],
  helpFolderPath = '../../help/cli-commands', // this is a relative path from the webpack dist directory,
): string {
  while (helpArgs.length > 0) {
    // if iac describe command is disabled, we should not return the help for it (and downfall to the iac one)
    if (isIacDescribeDisabled && helpArgs.includes('describe')) {
      helpArgs = helpArgs.slice(0, -1);
      continue;
    }

    // cleanse the filename to only contain letters
    // aka: /\W/g but figured this was easier to read
    const file = `${helpArgs.join('-').replace(/[^a-z0-9-]/gi, '')}.md`;
    const testHelpAbsolutePath = path.resolve(__dirname, helpFolderPath, file);
    if (fs.existsSync(testHelpAbsolutePath)) {
      return testHelpAbsolutePath;
    }
    helpArgs = helpArgs.slice(0, -1);
  }
  return path.resolve(__dirname, helpFolderPath, `README.md`); // Default help file
}

export default async function help(...args: MethodArgs): Promise<string> {
  const helpArgs = args.filter((arg): arg is string => typeof arg === 'string');
  const helpFileAbsolutePath = findHelpFile(helpArgs);
  return renderMarkdown(fs.readFileSync(helpFileAbsolutePath, 'utf8'));
}
