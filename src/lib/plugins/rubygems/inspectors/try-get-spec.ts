import * as path from 'path';
import * as fs from 'then-fs';

interface File {
  name: string;
  contents: string;
}

export interface Files {
  gemfileLock?: File;
  gemfile?: File;
  gemspec?: File;
}

export async function tryGetSpec(
  dir: string,
  name: string,
): Promise<File | null> {
  const filePath = path.resolve(dir, name);

  if (await fs.exists(filePath)) {
    return {
      name,
      contents: Buffer.from(await fs.readFile(filePath)).toString('base64'),
    };
  }
  return null;
}
