import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';

export function createIacDir(): void {
  // this path will be able to be customised by the user in the future
  const iacPath: fs.PathLike = path.join('.iac-data/');
  try {
    if (!fs.existsSync(iacPath)) {
      fs.mkdirSync(iacPath, '700');
    }
    fs.accessSync(iacPath, fs.constants.W_OK);
  } catch {
    throw Error(
      'The .iac-data directory can not be created. ' +
        'Please make sure that the current working directory has write permissions',
    );
  }
}

export function extractBundle(response): Promise<void> {
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
