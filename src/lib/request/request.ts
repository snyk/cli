import { debug as debugModule } from 'debug';
import { bootstrap } from 'global-agent';
import * as http from 'http';
import * as https from 'https';
import { RequestOptions } from 'https';
import { getProxyForUrl } from 'proxy-from-env';
import * as querystring from 'querystring';
import { format } from 'url';
import * as zlib from 'zlib';
import { Global } from '../../cli/args';
import * as analytics from '../analytics';
import * as config from '../config';
import { getVersion } from '../version';
import { Payload } from './types';

const debug = debugModule('snyk:req');
const snykDebug = debugModule('snyk');

declare const global: Global;

export = async function makeRequest(
  payload: Payload,
): Promise<{ res: http.IncomingMessage; body: any }> {
  // This ensures we support lowercase http(s)_proxy values as well
  // The weird IF around it ensures we don't create an envvar with a value of undefined, which throws error when trying to use it as a proxy
  if (process.env.HTTP_PROXY || process.env.http_proxy) {
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
  }
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    process.env.HTTPS_PROXY =
      process.env.HTTPS_PROXY || process.env.https_proxy;
  }

  const versionNumber = await getVersion();

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

  const parsedUrl = new URL(payload.url);

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

  const method: Required<RequestOptions['method']> = (
    payload.method || 'get'
  ).toLowerCase();
  let url = payload.url;

  if (payload.qs) {
    // Parse the URL and append the search part - this will take care of adding the '/?' part if it's missing
    const urlObject = new URL(url);
    urlObject.search = querystring.stringify(payload.qs);
    url = urlObject.toString();
    delete payload.qs;
  }

  const options: RequestOptions = {
    headers: payload.headers,
    timeout: payload.timeout,
    family: payload.family,
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

  try {
    const response = await request(method, url, data, options);
    debug(
      'response (%s): ',
      response.res.statusCode,
      JSON.stringify(response.body),
    );
    return response;
  } catch (err) {
    debug(err);
    throw err;
  }
};

async function request(
  method: RequestOptions['method'],
  url: string,
  data?: any,
  options: RequestOptions = {},
): Promise<{ res: http.IncomingMessage; body: string }> {
  return new Promise((resolve, reject) => {
    const client = new URL(url).protocol === 'https:' ? https : http;
    const requestOptions = {
      ...options,
      method,
      agent: new client.Agent({ keepAlive: true }),
    };
    const request = client.request(url, requestOptions, (response) => {
      const body: any[] = [];
      response.on('data', (chunk: any) => body.push(Buffer.from(chunk)));
      response.on('end', () =>
        resolve({ res: response, body: Buffer.concat(body).toString('utf-8') }),
      );
    });
    request.on('error', reject);

    if (data) {
      request.write(data);
    }
  });
}
