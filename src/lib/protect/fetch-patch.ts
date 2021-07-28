import * as fs from 'fs';
import * as analytics from '../analytics';
import * as debugModule from 'debug';
import { makeRequest } from '../request';

const debug = debugModule('snyk:fetch-patch');

async function getPatchFile(
  patchUrl: string,
  patchFilename: string,
): Promise<string> {
  try {
    const response = await makeRequest({ url: patchUrl });
    if (
      !response ||
      !response.res ||
      !response.body ||
      response.res.statusCode !== 200
    ) {
      throw response;
    }
    fs.writeFileSync(patchFilename, response.body);
    debug(
      `Fetched patch from ${patchUrl} to ${patchFilename}, patch size ${response.body.length} bytes`,
    );
  } catch (error) {
    const errorMessage = `Failed to fetch patch from ${patchUrl} to ${patchFilename}`;
    debug(errorMessage, error);
    analytics.add('patch-fetch-fail', {
      message: (error && error.message) || errorMessage,
      code: error && error.res && error.res.statusCode,
      patchFilename,
      patchUrl,
    });
    throw new Error(errorMessage);
  }
  return patchFilename;
}

export = getPatchFile;
