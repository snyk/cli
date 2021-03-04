import * as fs from 'fs';
import * as path from 'path';
import { executeCommand } from './exec';

export async function getVersion(): Promise<string> {
  const root = path.resolve(__dirname, '../..');
  const filename = path.resolve(root, 'package.json');
  const version = require(filename).version;

  if (version && version !== '0.0.0') {
    return version;
  }

  try {
    const [branchName, commitStr, filesCount] = await Promise.all([
      executeCommand('git rev-parse HEAD', root),
      executeCommand('git rev-parse --abbrev-ref HEAD', root),
      executeCommand('git diff --shortstat', root),
    ]);

    const dirtyCount = parseInt(filesCount as string, 10) || 0;
    let curr = `${branchName}: ${commitStr}`;
    if (dirtyCount !== 0) {
      curr += ` (${dirtyCount} dirty files)`;
    }

    return curr;
  } catch (_err) {
    return 'unknown';
  }
}

export function isStandaloneBuild() {
  const standalonePath = path.join(__dirname, '../', 'STANDALONE');
  return fs.existsSync(standalonePath);
}
