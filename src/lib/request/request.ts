import { debug as debugModule } from 'debug';
import * as needle from 'needle';
import { parse, format } from 'url';
import * as querystring from 'querystring';
import * as zlib from 'zlib';
import config from '../config';
import { getProxyForUrl } from 'proxy-from-env';
import { Global } from '../../cli/args';
import { Payload } from './types';
import { getVersion } from '../version';
import * as https from 'https';
import * as http from 'http';
import { jsonStringifyLargeObject } from '../json';
import { MissingApiTokenError } from '../errors';
import { headerSnykAuthFailed } from './constants';
import { MAX_STRING_LENGTH } from '../constants';

const debug = debugModule('snyk:req');
const snykDebug = debugModule('snyk');

declare const global: Global;

function setupRequest(payload: Payload) {
  // This ensures we support lowercase http(s)_proxy values as well
  // The weird IF around it ensures we don't create an envvar with a value of undefined, which throws error when trying to use it as a proxy
  if (process.env.HTTP_PROXY || process.env.http_proxy) {
    process.env.HTTP_PROXY = process.env.HTTP_PROXY || process.env.http_proxy;
  }
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    process.env.HTTPS_PROXY =
      process.env.HTTPS_PROXY || process.env.https_proxy;
  }

  const versionNumber = getVersion();
  const body = payload.body;
  let data = body;

  delete payload.body;

  if (!payload.headers) {
    payload.headers = {};
  }

  payload.headers['x-snyk-cli-version'] = versionNumber;

  const noCompression = payload.noCompression;

  if (body && !noCompression) {
    debug('compressing request body');
    const json = JSON.stringify(body);
    if (json.length < 1e4) {
      debug(json);
    }

    // always compress going upstream
    data = zlib.gzipSync(json, { level: 9 });

    snykDebug('sending request to:', payload.url);
    snykDebug('request body size:', json.length);
    snykDebug('gzipped request body size:', data.length);

    let callGraphLength: number | null = null;
    if (body.callGraph) {
      callGraphLength = jsonStringifyLargeObject(body.callGraph).length;
      snykDebug('call graph size:', callGraphLength);
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
    const payloadStr = jsonStringifyLargeObject(payload);
    debug(
      'request payload: ',
      payloadStr.length > MAX_STRING_LENGTH
        ? payloadStr + '...(log line truncated)'
        : payloadStr,
    );
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
    use_proxy_from_env_var: false,
    json: payload.json,
    parse: payload.parse,
    headers: payload.headers,
    timeout: payload.timeout,
    follow_max: 5,
    family: payload.family,
    agent,
  };

  const proxyUri = getProxyForUrl(url);
  if (proxyUri) {
    snykDebug('using proxy:', proxyUri);
    options.proxy = proxyUri;
  } else {
    snykDebug('not using proxy');
  }

  if (global.ignoreUnknownCA) {
    debug('Using insecure mode (ignore unknown certificate authority)');
    options.rejectUnauthorized = false;
  }

  return { method, url, data, options };
}

export async function makeRequest(
  payload: Payload,
): Promise<{ res: needle.NeedleResponse; body: any }> {
  const { method, url, data, options } = setupRequest(payload);

  return new Promise((resolve, reject) => {
    needle.request(method, url, data, options, (err, res, respBody) => {
      if (res?.headers?.[headerSnykAuthFailed] === 'true') {
        return reject(new MissingApiTokenError());
      }
      // respBody potentially very large, do not output it in debug
      debug('response (%s)', (res || {}).statusCode);
      if (err) {
        debug('response err: %s', err);
        return reject(err);
      }

      resolve({ res, body: respBody });
    });
  });
}

export async function streamRequest(
  payload: Payload,
): Promise<needle.ReadableStream> {
  const { method, url, data, options } = setupRequest(payload);

  try {
    const result = await needle.request(method, url, data, options);
    const statusCode = await getStatusCode(result);
    debug('response (%s): <stream>', statusCode);
    return result;
  } catch (e) {
    debug(e);
    throw e;
  }
}

async function getStatusCode(stream: needle.ReadableStream): Promise<number> {
  return new Promise((resolve, reject) => {
    stream.on('header', (statusCode: number, headers: any) => {
      if (headers?.[headerSnykAuthFailed] === 'true') {
        return reject(new MissingApiTokenError());
      }
      resolve(statusCode);
    });
    stream.on('err', (err: Error) => {
      reject(err);
    });
  });
}
