import * as fs from 'fs';
import * as path from 'path';

export function getFileContents(
  root: string,
  fileName: string,
): {
  content: string;
  name: string;
} {
  const fullPath = path.resolve(root, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      'Manifest ' + fileName + ' not found at location: ' + fileName,
    );
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    content,
    name: fileName,
  };
}
