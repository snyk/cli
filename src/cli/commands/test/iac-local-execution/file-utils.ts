import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';
import { FailedToInitLocalCacheError } from './local-cache';
import * as YAML from 'yaml';

export function createIacDir(): void {
  // this path will be able to be customised by the user in the future
  const iacPath: fs.PathLike = path.join('.iac-data/');
  try {
    if (!fs.existsSync(iacPath)) {
      fs.mkdirSync(iacPath, '700');
    }
    fs.accessSync(iacPath, fs.constants.W_OK);
  } catch {
    throw new FailedToInitLocalCacheError();
  }
}

export function extractBundle(response: NodeJS.ReadableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    response
      .on('error', reject)
      .pipe(
        tar.x({
          C: path.join('.iac-data'),
        }),
      )
      .on('finish', resolve)
      .on('error', reject);
  });
}

const errorsToSkip = [
  'Insufficient indentation in flow collection',
  'Map keys must be unique',
];

// the YAML Parser is more strict than the Golang one in Policy Engine,
// so we decided to skip specific errors in order to be consistent.
// this function checks if the current error is one them
export function shouldThrowErrorFor(doc: YAML.Document.Parsed) {
  return (
    doc.errors.length !== 0 &&
    !errorsToSkip.some((e) => doc.errors[0].message.includes(e))
  );
}
