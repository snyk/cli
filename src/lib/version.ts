import * as fs from 'fs';
import * as path from 'path';

export function getVersion(): string {
  const root = path.resolve(__dirname, '../..');

  const { version } = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );

  return version;
}

/**
 * We use pkg to create standalone builds (binaries).
 * pkg uses `process.pkg` to identify itself at runtime so we can do the same.
 * https://github.com/vercel/pkg
 */
export function isStandaloneBuild() {
  return 'pkg' in process;
}
