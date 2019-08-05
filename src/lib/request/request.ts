import { debug as debugModule } from 'debug';
import * as needle from 'needle';
import { parse, format } from 'url';
import * as querystring from 'querystring';
import * as zlib from 'zlib';
import * as config from '../config';
import { getProxyForUrl } from 'proxy-from-env';
import * as ProxyAgent from 'proxy-agent';
import * as analytics from '../analytics';
import { Agent } from 'http';
import { Global } from '../../cli/args';
import { Payload } from './types';
import * as version from '../version';

const debug = debugModule('snyk:req');
const snykDebug = debugModule('snyk');

declare const global: Global;

export = function makeRequest(payload: Payload): Promise<{res: needle.NeedleResponse, body: any}> {
  return version().then((versionNumber) => (
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
        data = zlib.gzipSync(json, {level: 9});

        snykDebug('sending request to:', payload.url);
        snykDebug('request body size:', json.length);
        snykDebug('gzipped request body size:', data.length);
        if (!payload.url.endsWith('/analytics/cli')) {
          analytics.add('payloadSize', json.length);
          analytics.add('gzippedPayloadSize', data.length);
        }

        payload.headers['content-encoding'] = 'gzip';
        payload.headers['content-length'] = data.length;
      }

      const parsedUrl = parse(payload.url);

      if (parsedUrl.protocol === 'http:' && parsedUrl.hostname !== 'localhost') {
        debug('forcing api request to https');
        parsedUrl.protocol = 'https:';
        payload.url = format(parsedUrl);
      }

      // prefer config timeout unless payload specified
      if (!payload.hasOwnProperty('timeout')) {
        payload.timeout = config.timeout * 1000; // s -> ms
      }

      debug('request payload: ', JSON.stringify(payload));

      const method = (payload.method || 'get').toLowerCase() as needle.NeedleHttpVerbs;
      let url = payload.url;

      if (payload.qs) {
        url = url + '?' + querystring.stringify(payload.qs);
        delete payload.qs;
      }

      const options: needle.NeedleOptions = {
        json: payload.json,
        headers: payload.headers,
        timeout: payload.timeout,
        follow_max: 5,
      };

      const proxyUri = getProxyForUrl(url);
      if (proxyUri) {
        snykDebug('using proxy:', proxyUri);
        options.agent = new ProxyAgent(proxyUri) as unknown as Agent;
      } else {
        snykDebug('not using proxy');
      }

      if (global.ignoreUnknownCA) {
        debug('Using insecure mode (ignore unkown certificate authority)');
        options.rejectUnauthorized = false;
      }

      needle.request(method, url, data, options, (err, res, respBody) => {
        debug(err);
        debug('response (%s): ', (res || {}).statusCode, JSON.stringify(respBody));
        if (err) {
          return reject(err);
        }

        resolve({res, body: respBody});
      });
    })
  ));
};
