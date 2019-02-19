import * as needle from 'needle';
import * as fs from 'fs';
import * as analytics from '../analytics';
import * as debugModule from 'debug';
import * as proxyFromEnv from 'proxy-from-env';
import * as ProxyAgent from 'proxy-agent';

const debug = debugModule('snyk:fetch-patch');
const getProxyForUrl = proxyFromEnv.getProxyForUrl;

async function getPatchFile(patchUrl: string, patchFilename: string): Promise<string> {
  let options;
  const proxyUri = getProxyForUrl(patchUrl);
  if (proxyUri) {
    debug('Using proxy: ', proxyUri);
    options = { agent: new ProxyAgent(proxyUri) };
  }

  let res: needle.NeedleResponse;
  let patchData: string;
  try {
    res = await needle('get', patchUrl, options || {});
    if (!res || res.statusCode !== 200) {
      throw res;
    }
    patchData = res.body;
    debug(`Successfully downloaded patch from ${patchUrl}, patch size ${patchData.length} bytes`);
  } catch (error) {
    debug(`Failed to download patch from ${patchUrl}`, error);
    analytics.add('patch-fetch-fail', {
      message: error && (error.message || error.body),
      code: error && error.statusCode,
    });
    throw error;
  }

  try {
    fs.writeFileSync(patchFilename, patchData);
    debug(`Successfully wrote patch to ${patchFilename}`);
  } catch (error) {
    debug(`Failed to write patch to ${patchFilename}`, error);
    analytics.add('patch-fetch-fail', {
      message: error && error.message,
      patchFilename,
      patchUrl,
    });
    throw error;
  }

  return patchFilename;
}

module.exports = getPatchFile;
