import { debug as debugModule } from 'debug';
import * as needle from 'needle';
import { parse, format } from 'url';
import * as querystring from 'querystring';
import * as zlib from 'zlib';
import * as config from '../config';
import { getProxyForUrl } from 'proxy-from-env';
import { bootstrap } from 'global-agent';
import * as analytics from '../analytics';
import { Global } from '../../cli/args';
import { Payload } from './types';
import { getVersion } from '../version';
import * as https from 'https';
import * as http from 'http';

const debug = debugModule('snyk:req');
const snykDebug = debugModule('snyk');

declare const global: Global;

export = function makeRequest(
  payload: Payload,
): Promise<{ res: needle.NeedleResponse; body: any }> {
  // This ensures we support lowercase http(s)_proxy values as well
  // The weird IF around it ensures we don't create an envvar with a value of undefined, which throws error when trying to use it as a proxy
  if (process.env.HTTP_PROXY || process.env.http_proxy) {
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
  }
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    process.env.HTTPS_PROXY =
      process.env.HTTPS_PROXY || process.env.https_proxy;
  }

  return getVersion().then(
    (versionNumber) =>
      new Promise((resolve, reject) => {
        const body = payload.body;
        let data;

        delete payload.body;

        if (!payload.headers) {
          payload.headers = {};
        }

        payload.headers['x-snyk-cli-version'] = versionNumber;

        if (body) {
          const json = JSON.stringify(body);
          if (json.length < 1e4) {
            debug(JSON.stringify(body, null, 2));
          }

          // always compress going upstream
          data = zlib.gzipSync(json, { level: 9 });

          snykDebug('sending request to:', payload.url);
          snykDebug('request body size:', json.length);
          snykDebug('gzipped request body size:', data.length);

          let callGraphLength: number | null = null;
          if (body.callGraph) {
            callGraphLength = JSON.stringify(body.callGraph).length;
            snykDebug('call graph size:', callGraphLength);
          }

          if (!payload.url.endsWith('/analytics/cli')) {
            analytics.add('payloadSize', json.length);
            analytics.add('gzippedPayloadSize', data.length);

            if (callGraphLength) {
              analytics.add('callGraphPayloadSize', callGraphLength);
            }
          }

          payload.headers['content-encoding'] = 'gzip';
          payload.headers['content-length'] = data.length;
        }

        const parsedUrl = parse(payload.url);

        if (
          parsedUrl.protocol === 'http:' &&
          parsedUrl.hostname !== 'localhost' &&
          process.env.SNYK_HTTP_PROTOCOL_UPGRADE !== '0'
        ) {
          debug('forcing api request to https');
          parsedUrl.protocol = 'https:';
          payload.url = format(parsedUrl);
        }

        // prefer config timeout unless payload specified
        if (!payload.hasOwnProperty('timeout')) {
          payload.timeout = config.timeout * 1000; // s -> ms
        }

        try {
          debug('request payload: ', JSON.stringify(payload));
        } catch (e) {
          debug('request payload is too big to log', e);
        }

        const method = (
          payload.method || 'get'
        ).toLowerCase() as needle.NeedleHttpVerbs;
        let url = payload.url;

        if (payload.qs) {
          // Parse the URL and append the search part - this will take care of adding the '/?' part if it's missing
          const urlObject = new URL(url);
          urlObject.search = querystring.stringify(payload.qs);
          url = urlObject.toString();
          delete payload.qs;
        }

        const agent =
          parsedUrl.protocol === 'http:'
            ? new http.Agent({ keepAlive: true })
            : new https.Agent({ keepAlive: true });
        const options: needle.NeedleOptions = {
          json: payload.json,
          headers: payload.headers,
          timeout: payload.timeout,
          // eslint-disable-next-line @typescript-eslint/camelcase
          follow_max: 5,
          family: payload.family,
          agent,
        };

        const proxyUri = getProxyForUrl(url);
        if (proxyUri) {
          snykDebug('using proxy:', proxyUri);
          bootstrap({
            environmentVariableNamespace: '',
          });
        } else {
          snykDebug('not using proxy');
        }

        if (global.ignoreUnknownCA) {
          debug('Using insecure mode (ignore unknown certificate authority)');
          options.rejectUnauthorized = false;
        }

        needle.request(method, url, data, options, (err, res, respBody) => {
          debug(err);
          debug(
            'response (%s): ',
            (res || {}).statusCode,
            JSON.stringify(respBody),
          );
          if (err) {
            return reject(err);
          }

          resolve({ res, body: respBody });
        });
      }),
  );
};
