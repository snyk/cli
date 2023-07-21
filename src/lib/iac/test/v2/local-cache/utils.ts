import * as createDebugLogger from 'debug';
import * as path from 'path';

import { CustomError } from '../../../../errors';
import { streamRequest } from '../../../../request/request';
import { ReadableStream } from 'needle';

const debugLogger = createDebugLogger('snyk-iac');

export async function lookupLocal(
  iacCachePath: string,
  resourceName: string,
  userResourcePath: string | undefined,
  validResourceCondition: (path: string) => Promise<boolean>,
): Promise<string | undefined> {
  // Lookup in custom path.
  if (userResourcePath) {
    debugLogger('User configured path detected: %s', userResourcePath);

    if (await validResourceCondition(userResourcePath)) {
      return userResourcePath;
    } else {
      // When using this function please catch this Error and throw a new specific Custom Error.
      throw new InvalidUserPathError(
        `Failed to find a valid resource in the configured path: ${userResourcePath}`,
      );
    }
  }
  // Lookup in cache.
  else {
    const cachedResourcePath = path.join(iacCachePath, resourceName);
    if (await validResourceCondition(cachedResourcePath)) {
      return cachedResourcePath;
    }
  }
}

export class InvalidUserPathError extends CustomError {
  constructor(message: string) {
    super(message);
  }
}

export async function fetchCacheResource(url: string): Promise<Buffer> {
  const stream = await streamRequest({
    body: null,
    headers: {},
    method: 'get',
    url: url,
  });

  return streamToBuffer(stream);
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}
