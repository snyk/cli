import * as pathLib from 'path';
import { createWriteStream } from 'fs';
import { createDirectory } from './create-directory';

import debugModule = require('debug');
const debug = debugModule('snyk-log-error-to-disk');

export function saveErrorsToFile(contents: string, fileName: string): void {
  if (!(contents && fileName)) {
    return;
  }
  // create the directory if it doesn't exist
  const dirPath = pathLib.dirname(fileName);
  const createDirSuccess = createDirectory(dirPath);
  if (createDirSuccess) {
    try {
      const ws = createWriteStream(fileName, { flags: 'w' });
      ws.on('error', (err) => {
        debug(`Error writing file to disk: ${err}`);
      });
      ws.write(contents);
      ws.end('\n');
    } catch (err) {
      debug(`Error writing file to disk: ${err}`);
    }
  }
}
