import * as fs from 'fs';
import { renderMarkdown } from '../../cli/commands/help/markdown-renderer';

export function readAppsHelpMarkdown(filename: string): string {
  const file = fs.readFileSync(filename, 'utf8');
  return renderMarkdown(file);
}
