module.exports = makeRequest;

var debug = require('debug')('snyk:req');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var request = require('request');
var stream = require('stream');
var parse = require('url').parse;
var format = require('url').format;
var zlib = require('zlib');

function makeRequest(payload, callback) {
  var promise = new Promise(function (resolve, reject) {
    var body = payload.body;
    var bodyStream;

    delete payload.body;

    if (body) {
      // always compress going upstream
      bodyStream = new stream.Readable();
      var json = JSON.stringify(body);
      bodyStream.push(json);
      bodyStream.push(null);

      debug('compressing body (%s)', json.length);
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

    debug('request payload: ', JSON.stringify(payload));
    var req = request(payload, function (error, res, body) {
      debug(error);
      debug('response (%s): ', (res || {}).statusCode, JSON.stringify(body));
      if (error) {
        return reject(error);
      }

      resolve({ res: res, body: body });
    });

    if (body) {
      bodyStream.pipe(zlib.createGzip()).pipe(req);
    }
  });

  // make callbacks and promises work
  if (callback) {
    promise.then(function (res) {
      callback(null, res.res, res.body);
    }).catch(callback);
  }

  return promise;
}