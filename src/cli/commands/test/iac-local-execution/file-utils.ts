import * as fs from 'fs';
import * as tar from 'tar';
import * as path from 'path';
import { FailedToInitLocalCacheError, LOCAL_POLICY_ENGINE_DIR } from './local-cache';

export function createIacDir(): void {
  // this path will be able to be customised by the user in the future
  const iacPath: fs.PathLike = path.join(LOCAL_POLICY_ENGINE_DIR);
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
          C: path.join(LOCAL_POLICY_ENGINE_DIR),
        }),
      )
      .on('finish', resolve)
      .on('error', reject);
  });
}
