import * as http from 'http';
import * as net from 'net';
import { AddressInfo } from 'net';
import { ForwardProxy, startForwardProxy } from '../../util/startForwardProxy';

const listenLocal = (
  handler: http.RequestListener,
): Promise<{ server: http.Server; port: number }> =>
  new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port });
    });
  });

const closeServer = (server: http.Server): Promise<void> =>
  new Promise((resolve) => server.close(() => resolve()));

const proxyPort = (proxy: ForwardProxy): number =>
  Number(new URL(proxy.url).port);

const getThroughProxy = (
  proxy: ForwardProxy,
  targetUrl: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: '127.0.0.1',
        port: proxyPort(proxy),
        path: targetUrl,
        agent: false,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve(body));
      },
    );
    req.on('error', reject);
  });

const connectThroughProxy = (
  proxy: ForwardProxy,
  authority: string,
): Promise<net.Socket> =>
  new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: proxyPort(proxy),
      method: 'CONNECT',
      path: authority,
      agent: false,
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) {
        resolve(socket);
      } else {
        reject(new Error(`CONNECT failed with ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.end();
  });

const readUntilClosed = (socket: net.Socket): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    socket.on('data', (chunk) => (data += chunk));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });

describe('startForwardProxy', () => {
  let proxy: ForwardProxy;
  let target: http.Server;
  let targetPort: number;

  beforeAll(async () => {
    proxy = await startForwardProxy();
    const local = await listenLocal((req, res) => {
      res.end(`hello from ${req.url}`);
    });
    target = local.server;
    targetPort = local.port;
  });

  beforeEach(() => {
    proxy.reset();
  });

  afterAll(async () => {
    await proxy.close();
    await closeServer(target);
  });

  it('forwards a plain HTTP request and records the requested host', async () => {
    const body = await getThroughProxy(
      proxy,
      `http://127.0.0.1:${targetPort}/plain`,
    );

    expect(body).toEqual('hello from /plain');
    expect(proxy.requestedHosts()).toEqual([`127.0.0.1:${targetPort}`]);
  });

  it('tunnels a CONNECT request and records the requested host', async () => {
    const socket = await connectThroughProxy(proxy, `127.0.0.1:${targetPort}`);
    socket.write(
      'GET /tunnel HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n',
    );
    const response = await readUntilClosed(socket);

    expect(response).toContain('200 OK');
    expect(response).toContain('hello from /tunnel');
    expect(proxy.requestedHosts()).toEqual([`127.0.0.1:${targetPort}`]);
  });

  it('clears the recorded hosts on reset', async () => {
    await getThroughProxy(proxy, `http://127.0.0.1:${targetPort}/before`);
    expect(proxy.requestedHosts()).toHaveLength(1);

    proxy.reset();

    expect(proxy.requestedHosts()).toEqual([]);
  });
});
