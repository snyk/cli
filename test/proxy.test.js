var tap = require('tap');
var test = tap.test;
var url = require('url');
var http = require('http');
var nock = require('nock');
var request = require('../lib/request');

var proxyPort = 4242;
var httpRequestHost = 'http://localhost:8000';
var httpsRequestHost = 'https://snyk.io:443';
var requestPath = '/api/v1/verify/token';

/**
 * Verify support for http(s) proxy from environments variables
 * (http_proxy, https_proxy, no_proxy)
 * see https://www.gnu.org/software/wget/manual/html_node/Proxies.html
 */
test('request respects proxy environment variables', function (t) {
  t.plan(6);

  t.test('direct http access', function (t) {
    var nockClient = nock(httpRequestHost).post(requestPath).reply(200, {});	
    return request({ method: 'post', url: httpRequestHost + requestPath })
    .then(function () {	
      t.ok(nockClient.isDone(), 'direct call without a proxy');
      nock.cleanAll();
    })
    .catch(err => t.fail(err.message));
  });

  t.test('direct https access', function (t) {
    var nockClient = nock(httpsRequestHost).post(requestPath).reply(200, {});	
    return request({ method: 'post', url: httpsRequestHost + requestPath })
    .then(function () {	
      t.ok(nockClient.isDone(), 'direct call without a proxy');
      nock.cleanAll();
    })
    .catch(err => t.fail(err.message));
  });

  t.test('http_proxy', function (t) {
    process.env.http_proxy = `http://localhost:${proxyPort}`;
    var proxy = http.createServer(function (req, res) {
      t.equal(req.url, httpRequestHost + requestPath, 'http_proxy url ok');
      res.end();
    });
    proxy.listen(proxyPort);
    // http is only supported for localhost
    return request({ method: 'post', url: httpRequestHost + requestPath })
    .catch(err => t.fail(err.message))
    .then(() => {
      proxy.close();
      delete process.env.http_proxy;
    });
  });

  t.test('HTTP_PROXY', function (t) {
    process.env.HTTP_PROXY = `http://localhost:${proxyPort}`;
    var proxy = http.createServer(function (req, res) {
      t.equal(req.url, httpRequestHost + requestPath, 'HTTP_PROXY url ok');
      res.end();
    });
    proxy.listen(proxyPort);
    // http is only supported for localhost
    return request({ method: 'post', url: httpRequestHost + requestPath })
    .catch(err => t.fail(err.message))
    .then(() => {
      proxy.close();
      delete process.env.HTTP_PROXY;
    });
  });


  t.test('https_proxy', function (t) {
    process.env.https_proxy = `http://localhost:${proxyPort}`;
    var proxy = http.createServer();
    proxy.setTimeout(1000);
    proxy.on('connect', (req, cltSocket, head) => {
      const {hostname, port} = url.parse(`https://${req.url}`);
      t.equal(hostname, url.parse(httpsRequestHost).hostname,
        'https_proxy url hostname ok');
      t.equal(port, url.parse(httpsRequestHost).port,
        'https_proxy url port ok');
      cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                      'Proxy-agent: Node.js-Proxy\r\n' +
                      'Connection: close\r\n' +
                      '\r\n',
        function () { cltSocket.end(); });
    });
    
    proxy.listen(proxyPort);
    return request({ method: 'post', url: httpsRequestHost + requestPath })
    .catch(() => {}) // client socket being closed generates an error here
    .then(() => {
      proxy.close();
      delete process.env.https_proxy;
    });
  });

  t.test('HTTPS_PROXY', function (t) {
    process.env.HTTPS_PROXY = `http://localhost:${proxyPort}`;
    var proxy = http.createServer();
    proxy.setTimeout(1000);
    proxy.on('connect', (req, cltSocket, head) => {
      const {hostname, port} = url.parse(`https://${req.url}`);
      t.equal(hostname, url.parse(httpsRequestHost).hostname,
        'HTTPS_PROXY url hostname ok');
      t.equal(port, url.parse(httpsRequestHost).port,
        'HTTPS_PROXY url port ok');
      cltSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                      'Proxy-agent: Node.js-Proxy\r\n' +
                      'Connection: close\r\n' +
                      '\r\n',
        function () { cltSocket.end(); });
    });
    
    proxy.listen(proxyPort);
    return request({ method: 'post', url: httpsRequestHost + requestPath })
    .catch(() => {}) // client socket being closed generates an error here
    .then(() => {
      proxy.close();
      delete process.env.HTTPS_PROXY;
    });
  });
});
