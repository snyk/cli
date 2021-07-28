const tap = require('tap');
const test = tap.test;
const url = require('url');
const http = require('http');
const nock = require('nock');
import { makeRequest } from '../src/lib/request';

const proxyPort = 4242;
const httpRequestHost = 'http://localhost:8000';
const httpsRequestHost = 'https://snyk.io:443';
const requestPath = '/api/v1/verify/token';

/**
 * Verify support for http(s) proxy from environments variables
 * (http_proxy, https_proxy, no_proxy)
 * see https://www.gnu.org/software/wget/manual/html_node/Proxies.html
 */
test('request respects proxy environment variables', function(t) {
  t.plan(6);

  t.test('direct http access', function(t) {
    const nockClient = nock(httpRequestHost)
      .post(requestPath)
      .reply(200, {});
    return makeRequest({ method: 'post', url: httpRequestHost + requestPath })
      .then(function() {
        t.ok(nockClient.isDone(), 'direct call without a proxy');
        nock.cleanAll();
      })
      .catch((err) => t.fail(err.message));
  });

  t.test('direct https access', function(t) {
    const nockClient = nock(httpsRequestHost)
      .post(requestPath)
      .reply(200, {});
    return makeRequest({ method: 'post', url: httpsRequestHost + requestPath })
      .then(function() {
        t.ok(nockClient.isDone(), 'direct call without a proxy');
        nock.cleanAll();
      })
      .catch((err) => t.fail(err.message));
  });

  t.test('http_proxy', function(t) {
    // NO_PROXY is set in CircleCI and brakes test purpose
    const tmpNoProxy = process.env.NO_PROXY;
    delete process.env.NO_PROXY;

    // Restore env variables
    t.teardown(() => {
      process.env.NO_PROXY = tmpNoProxy;
      delete process.env.http_proxy;
      delete process.env.HTTP_PROXY;
      delete global.GLOBAL_AGENT;
    });

    // eslint-disable-next-line @typescript-eslint/camelcase
    process.env.http_proxy = `http://localhost:${proxyPort}`;
    const proxy = http.createServer(function(req, res) {
      t.equal(req.url, httpRequestHost + requestPath, 'http_proxy url ok');
      res.end();
    });
    proxy.listen(proxyPort);
    // http is only supported for localhost
    return makeRequest({ method: 'post', url: httpRequestHost + requestPath })
      .catch((err) => t.fail(err.message))
      .then(() => {
        t.equal(process.env.http_proxy, process.env.HTTP_PROXY);
        proxy.close();
      });
  });

  t.test('HTTP_PROXY', function(t) {
    // NO_PROXY is set in CircleCI and brakes test purpose
    const tmpNoProxy = process.env.NO_PROXY;
    delete process.env.NO_PROXY;

    // Restore env variables
    t.teardown(() => {
      process.env.NO_PROXY = tmpNoProxy;
      delete process.env.HTTP_PROXY;
      delete global.GLOBAL_AGENT;
    });

    process.env.HTTP_PROXY = `http://localhost:${proxyPort}`;
    const proxy = http.createServer(function(req, res) {
      t.equal(req.url, httpRequestHost + requestPath, 'HTTP_PROXY url ok');
      res.end();
    });
    proxy.listen(proxyPort);
    // http is only supported for localhost
    return makeRequest({ method: 'post', url: httpRequestHost + requestPath })
      .catch((err) => t.fail(err.message))
      .then(() => {
        proxy.close();
      });
  });

  t.test('https_proxy', function(t) {
    // NO_PROXY is set in CircleCI and brakes test purpose
    const tmpNoProxy = process.env.NO_PROXY;
    delete process.env.NO_PROXY;

    t.teardown(() => {
      process.env.NO_PROXY = tmpNoProxy;
      delete process.env.https_proxy;
      delete process.env.HTTPS_PROXY;
      delete global.GLOBAL_AGENT;
    });

    // eslint-disable-next-line @typescript-eslint/camelcase
    process.env.https_proxy = `http://localhost:${proxyPort}`;
    const proxy = http.createServer();
    proxy.setTimeout(1000);
    proxy.on('connect', (req, cltSocket) => {
      const proxiedUrl = url.parse(`https://${req.url}`);
      t.equal(
        proxiedUrl.hostname,
        url.parse(httpsRequestHost).hostname,
        'https_proxy url hostname ok',
      );
      t.equal(
        proxiedUrl.port,
        url.parse(httpsRequestHost).port,
        'https_proxy url port ok',
      );
      cltSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' +
          'Proxy-agent: Node.js-Proxy\r\n' +
          'Connection: close\r\n' +
          '\r\n',
        function() {
          cltSocket.end();
        },
      );
    });

    proxy.listen(proxyPort);
    return makeRequest({ method: 'post', url: httpsRequestHost + requestPath })
      .catch(() => {}) // client socket being closed generates an error here
      .then(() => {
        t.equal(process.env.https_proxy, process.env.HTTPS_PROXY);
        proxy.close();
      });
  });

  t.test('HTTPS_PROXY', function(t) {
    // NO_PROXY is set in CircleCI and brakes test purpose
    const tmpNoProxy = process.env.NO_PROXY;
    delete process.env.NO_PROXY;

    t.teardown(() => {
      process.env.NO_PROXY = tmpNoProxy;
      delete process.env.HTTPS_PROXY;
      delete global.GLOBAL_AGENT;
    });

    process.env.HTTPS_PROXY = `http://localhost:${proxyPort}`;
    const proxy = http.createServer();
    proxy.setTimeout(1000);
    proxy.on('connect', (req, cltSocket) => {
      const proxiedUrl = url.parse(`https://${req.url}`);
      t.equal(
        proxiedUrl.hostname,
        url.parse(httpsRequestHost).hostname,
        'HTTPS_PROXY url hostname ok',
      );
      t.equal(
        proxiedUrl.port,
        url.parse(httpsRequestHost).port,
        'HTTPS_PROXY url port ok',
      );
      cltSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' +
          'Proxy-agent: Node.js-Proxy\r\n' +
          'Connection: close\r\n' +
          '\r\n',
        function() {
          cltSocket.end();
        },
      );
    });

    proxy.listen(proxyPort);
    return makeRequest({ method: 'post', url: httpsRequestHost + requestPath })
      .catch(() => {}) // client socket being closed generates an error here
      .then(() => {
        proxy.close();
      });
  });
});
