import * as http from 'http';
import * as net from 'net';
import { AddressInfo } from 'net';

export interface ForwardProxy {
  url: string;
  requestedHosts(): string[];
  reset(): void;
  close(): Promise<void>;
}

/**
 * Starts a local HTTP forward proxy that records every host it is asked to
 * reach. HTTPS is tunnelled with CONNECT without TLS interception.
 */
export function startForwardProxy(): Promise<ForwardProxy> {
  const hosts: string[] = [];
  const sockets = new Set<net.Socket>();

  const track = (socket: net.Socket): net.Socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    return socket;
  };

  const server = http.createServer((req, res) => {
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }

    const port = target.port || '80';
    hosts.push(`${target.hostname}:${port}`);

    const headers = { ...req.headers };
    delete headers['proxy-connection'];

    const upstream = http.request(
      {
        host: target.hostname,
        port,
        method: req.method,
        path: target.pathname + target.search,
        headers,
        agent: false,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );
    upstream.on('socket', track);
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502);
      }
      res.end();
    });
    req.pipe(upstream);
  });

  server.on('connection', (socket) => track(socket));

  server.on('connect', (req, clientSocket: net.Socket, head: Buffer) => {
    const authority = req.url ?? '';
    hosts.push(authority);

    const separator = authority.lastIndexOf(':');
    const host = authority.slice(0, separator);
    const port = Number(authority.slice(separator + 1));

    const upstream = track(net.connect(port, host));
    const destroyBoth = () => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', destroyBoth);
    clientSocket.on('error', destroyBoth);

    upstream.on('connect', () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) {
        upstream.write(head);
      }
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        requestedHosts: () => [...hosts],
        reset: () => {
          hosts.length = 0;
        },
        close: () =>
          new Promise<void>((done) => {
            sockets.forEach((socket) => socket.destroy());
            server.close(() => done());
          }),
      });
    });
  });
}
