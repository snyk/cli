import path from 'path';
import fs from 'fs';

interface File {
  name: string;
  contents: string;
}

export interface Files {
  gemfileLock?: File;
  gemspec?: File;
}

export async function tryGetSpec(
  dir: string,
  name: string,
): Promise<File | null> {
  const filePath = path.resolve(dir, name);
  if (fs.existsSync(filePath)) {
    return {
      name,
      contents: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
    };
  }
  return null;
}
