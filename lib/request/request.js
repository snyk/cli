/* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
/* jshint camelcase: false */
module.exports = makeRequest;

var debug = require('debug')('snyk:req');
var snykDebug = require('debug')('snyk');
var needle = require('needle');
var stream = require('stream');
var parse = require('url').parse;
var format = require('url').format;
var querystring = require('querystring');
var zlib = require('zlib');
var config = require('../config');
var getProxyForUrl = require('proxy-from-env').getProxyForUrl;
var ProxyAgent = require('proxy-agent');
var analytics = require('../analytics');

function makeRequest(payload) {
  return new Promise(function (resolve, reject) {
    var body = payload.body;
    var data;

    delete payload.body;

    if (body) {
      var json = JSON.stringify(body);
      if (json.length < 1e4) {
        debug(JSON.stringify(body, '', 2));
      }

      // always compress going upstream
      data = zlib.gzipSync(json);

      snykDebug('sending request to:', payload.url);
      snykDebug('request body size:', json.length);
      snykDebug('gzipped request body size:', data.length);
      if (!payload.url.endsWith('/analytics/cli')) {
        analytics.add('payloadSize', json.length);
        analytics.add('gzippedPayloadSize', data.length);
      }

      if (!payload.headers) {
        payload.headers = {};
      }

      payload.headers['content-encoding'] = 'gzip';
      payload.headers['content-length'] = data.length;
    }

    var url = parse(payload.url);

    if (url.protocol === 'http:' && url.hostname !== 'localhost') {
      debug('forcing api request to https');
      url.protocol = 'https:';
      payload.url = format(url);
    }

    // prefer config timeout unless payload specified
    if (!payload.hasOwnProperty('timeout')) {
      payload.timeout = config.timeout * 1000; // s -> ms
    }

    debug('request payload: ', JSON.stringify(payload));

    var method = (payload.method || 'get').toLowerCase();
    url = payload.url;

    if (payload.qs) {
      url = url + '?' + querystring.stringify(payload.qs);
      delete payload.qs;
    }

    var options = {
      json: payload.json,
      headers: payload.headers,
      timeout: payload.timeout,
      follow_max: 5,
    };

    var proxyUri = getProxyForUrl(url);
    if (proxyUri) {
      snykDebug('using proxy:', proxyUri);
      options.agent = new ProxyAgent(proxyUri);
    } else {
      snykDebug('not using proxy');
    }

    if (global.ignoreUnknownCA) {
      debug('Using insecure mode (ignore unkown certificate authority)');
      options.rejectUnauthorized = false;
    }

    needle.request(method, url, data, options, function (err, res, body) {
      debug(err);
      debug('response (%s): ', (res || {}).statusCode, JSON.stringify(body));
      if (err) {
        return reject(err);
      }

      resolve({ res: res, body: body });
    });
  });
}
