import * as path from 'path';
import { executeCommand } from './exec';

const root = path.resolve(__dirname, '../..');

export function getVersion(): Promise<string> {
  return new Promise((resolve) => {
    const filename = path.resolve(root, 'package.json');
    const version = require(filename).version;

    if (version && version !== '0.0.0') {
      return resolve(version);
    }

    // else we're in development, give the commit out
    // get the last commit and whether the working dir is dirty
    const promises = [branch(), commit(), dirty()];

    resolve(getBranchCommitAndDirty(promises));
  });
}

async function getBranchCommitAndDirty(promises): Promise<string> {
  try {
    const res: string[] = await Promise.all(promises);
    const branchName = res[0];
    const commitStr = res[1];
    const filesCount = res[2];
    const dirtyCount = parseInt(filesCount, 10);
    let curr = branchName + ': ' + commitStr;
    if (dirtyCount !== 0) {
      curr += ' (' + dirtyCount + ' dirty files)';
    }

    return curr;
  } catch {
    // handle any point where the git based lookup fails
    return 'unknown';
  }
}

const commit = () => executeCommand('git rev-parse HEAD', root);
const branch = () => executeCommand('git rev-parse --abbrev-ref HEAD', root);
const dirty = () =>
  executeCommand(
    'expr $(git status --porcelain 2>/dev/null| ' + 'egrep "^(M| M)" | wc -l)',
    root,
  );
