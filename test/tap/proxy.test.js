const tap = require('tap');
const test = tap.test;
const url = require('url');
const http = require('http');
import { makeRequest } from '../../src/lib/request';

const proxyPort = 4242;
const httpRequestHost = 'http://localhost:8000';
const httpsRequestHost = 'https://snyk.io:443';
const requestPath = '/api/v1/verify/token';

/**
 * Verify support for http(s) proxy from environments variables
 * (http_proxy, https_proxy, no_proxy)
 * see https://www.gnu.org/software/wget/manual/html_node/Proxies.html
 */
test('request respects proxy environment variables', async (t) => {
  t.plan(4);

  t.test('http_proxy', async (t) => {
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

    process.env.http_proxy = `http://localhost:${proxyPort}`;
    const proxy = http.createServer(function(req, res) {
      t.equal(req.url, httpRequestHost + requestPath, 'http_proxy url ok');
      res.end();
    });
    proxy.listen(proxyPort);
    // http is only supported for localhost
    const result = await makeRequest({
      method: 'post',
      url: httpRequestHost + requestPath,
    });
    t.equal(result.res.statusCode, 200, '');
    proxy.close();
  });

  t.test('HTTP_PROXY', async (t) => {
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
    const result = await makeRequest({
      method: 'post',
      url: httpRequestHost + requestPath,
    });
    t.equal(result.res.statusCode, 200, '');
    proxy.close();
  });

  t.test('https_proxy', async (t) => {
    t.plan(3);

    // NO_PROXY is set in CircleCI and brakes test purpose
    const tmpNoProxy = process.env.NO_PROXY;
    delete process.env.NO_PROXY;

    t.teardown(() => {
      process.env.NO_PROXY = tmpNoProxy;
      delete process.env.https_proxy;
      delete process.env.HTTPS_PROXY;
      delete global.GLOBAL_AGENT;
    });

    process.env.https_proxy = `http://localhost:${proxyPort}`;
    const proxy = http.createServer();
    proxy.setTimeout(1000);
    proxy.on('connect', (req, cltSocket) => {
      const proxiedUrl = url.parse(`https://${req.url}`);
      t.equal(req.method, 'CONNECT', 'Proxy for HTTPS using CONNECT');
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
    try {
      await makeRequest({
        method: 'post',
        url: httpsRequestHost + requestPath,
      });
    } catch (e) {
      // an exception is expected
    }
    proxy.close();
  });

  t.test('HTTPS_PROXY', async (t) => {
    t.plan(3);

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
      t.equal(req.method, 'CONNECT', 'Proxy for HTTPS using CONNECT');
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
    try {
      await makeRequest({
        method: 'post',
        url: httpsRequestHost + requestPath,
      });
    } catch (e) {
      // an exception is expected
    }
    proxy.close();
  });
});
