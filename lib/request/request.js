/* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
/* jshint camelcase: false */
module.exports = makeRequest;

var debug = require('debug')('snyk:req');
var snykDebug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var needle = require('needle');
var stream = require('stream');
var parse = require('url').parse;
var format = require('url').format;
var querystring = require('querystring');
var zlib = require('zlib');
var config = require('../config');
var getProxyForUrl = require('proxy-from-env').getProxyForUrl;

function makeRequest(payload) {
  return new Promise(function (resolve, reject) {
    var body = payload.body;
    var bodyStream;

    delete payload.body;

    if (body) {
      // always compress going upstream
      bodyStream = new stream.Readable();
      var json = JSON.stringify(body);
      bodyStream.push(json);
      bodyStream.push(null);
      bodyStream = bodyStream.pipe(zlib.createGzip());

      snykDebug('sending request to:', payload.url);
      snykDebug('request body size:', json.length);
      if (json.length < 1e4) {
        debug(JSON.stringify(body, '', 2));
      }

      if (!payload.headers) {
        payload.headers = {};
      }

      payload.headers['content-encoding'] = 'gzip';
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

    var proxy = getProxyForUrl(url);
    if (proxy) {
      snykDebug('Using proxy: ', proxy);
      options.proxy = proxy;
    } else {
      snykDebug('Not using proxy');
    }

    if (global.ignoreUnknownCA) {
      debug('Using insecure mode (ignore unkown certificate authority)');
      options.rejectUnauthorized = false;
    }

    needle.request(method, url, bodyStream, options, function (err, res, body) {
      debug(err);
      debug('response (%s): ', (res || {}).statusCode, JSON.stringify(body));
      if (err) {
        return reject(err);
      }

      resolve({ res: res, body: body });
    });
  });
}
