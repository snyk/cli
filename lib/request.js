module.exports = makeRequest;

var debug = require('debug')('snyk');
var request = require('request');
var stream = require('stream');
var zlib = require('zlib');

function makeRequest(payload, callback) {
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

  debug('request payload: ', JSON.stringify(payload));
  var req = request(payload, callback);

  if (body) {
    bodyStream.pipe(zlib.createGzip()).pipe(req);
  }
}