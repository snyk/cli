import * as express from 'express';
import * as http from 'http';
import * as net from 'net';

export type FakeDeepCodeServer = {
  getRequests: () => express.Request[];
  popRequest: () => express.Request;
  popRequests: (num: number) => express.Request[];
  setCustomResponse: (next: Record<string, unknown>) => void;
  setFiltersResponse: (next: Record<string, unknown>) => void;
  setDeepProxyFiltersResponse: (next: Record<string, unknown>) => void;
  setNextResponse: (r: any) => void;
  setNextStatusCode: (code: number) => void;
  setSarifResponse: (r: any) => void;
  listen: (callback: () => void) => void;
  restore: () => void;
  close: (callback: () => void) => void;
  getPort: () => number;
};

export const fakeDeepCodeServer = (): FakeDeepCodeServer => {
  let filtersResponse: Record<string, unknown> | null = {
    configFiles: [],
    extensions: ['.java'],
  };
  let deepProxyFiltersResponse: Record<string, unknown> | null = {
    configFiles: [],
    extensions: ['.java'],
  };
  let sarifResponse: Record<string, unknown> | null = null;
  let requests: express.Request[] = [];
  // the status code to return for the next request, overriding statusCode
  let nextResponse: Record<string, unknown> | undefined = undefined;
  let nextStatusCode: number | undefined = undefined;
  let customResponse: Record<string, unknown> | undefined = undefined;
  let server: http.Server | undefined = undefined;
  const sockets = new Set();

  const restore = () => {
    requests = [];
    customResponse = undefined;
    nextResponse = undefined;
    nextStatusCode = undefined;
    sarifResponse = null;
    filtersResponse = { configFiles: [], extensions: ['.java', '.js'] };
    deepProxyFiltersResponse = {
      configFiles: [],
      extensions: ['.java', '.js'],
    };
  };

  const getRequests = () => {
    return requests;
  };

  const popRequest = () => {
    return requests.pop()!;
  };

  const popRequests = (num: number) => {
    return requests.splice(requests.length - num, num);
  };

  const setCustomResponse = (next: typeof customResponse) => {
    customResponse = next;
  };

  const setFiltersResponse = (response: string | Record<string, unknown>) => {
    if (typeof response === 'string') {
      filtersResponse = JSON.parse(response);
      return;
    }
    filtersResponse = response;
  };

  const setDeepProxyFiltersResponse = (
    response: string | Record<string, unknown>,
  ) => {
    if (typeof response === 'string') {
      deepProxyFiltersResponse = JSON.parse(response);
      return;
    }
    deepProxyFiltersResponse = response;
  };

  const setNextResponse = (response: string | Record<string, unknown>) => {
    if (typeof response === 'string') {
      nextResponse = JSON.parse(response);
      return;
    }
    nextResponse = response;
  };

  const setNextStatusCode = (code: number) => {
    nextStatusCode = code;
  };

  const setSarifResponse = (response: string | Record<string, unknown>) => {
    if (typeof response === 'string') {
      sarifResponse = JSON.parse(response);
      return;
    }
    sarifResponse = response;
  };

  const app = express();

  app.use((req, res, next) => {
    requests.push(req);
    next();
  });

  app.use((req, res, next) => {
    if (nextStatusCode) {
      const code = nextStatusCode;
      res.status(code);
    }

    if (nextResponse) {
      const response = nextResponse;
      res.send(response);
      return;
    }
    next();
  });

  app.get('/filters', (req, res) => {
    res.status(200);
    res.send(filtersResponse);
  });

  app.post('/bundle', (req, res) => {
    res.status(200);

    res.send({
      bundleHash: 'bundle-hash',
      missingFiles: [],
    });
  });

  app.post('/analysis', (req, res) => {
    res.status(200);
    res.send({
      timing: {
        fetchingCode: 1,
        analysis: 1,
        queue: 1,
      },
      coverage: [],
      status: 'COMPLETE',
      type: 'sarif',
      sarif: sarifResponse,
    });
  });

  const listenPromise = () => {
    return new Promise<void>((resolve) => {
      server = http.createServer(app).listen(resolve);

      server?.on('connection', (socket) => {
        sockets.add(socket);
      });
    });
  };

  const listen = (callback: () => void) => {
    listenPromise().then(callback);
  };

  const closePromise = () => {
    return new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
      server = undefined;
    });
  };

  const close = (callback: () => void) => {
    for (const socket of sockets) {
      (socket as net.Socket)?.destroy();
      sockets.delete(socket);
    }

    closePromise().then(callback);
  };

  const getPort = () => {
    const address = server?.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    throw new Error('port not found');
  };

  return {
    getRequests,
    popRequest,
    popRequests,
    setCustomResponse,
    setFiltersResponse,
    setDeepProxyFiltersResponse,
    setSarifResponse,
    setNextResponse,
    setNextStatusCode,
    listen,
    restore,
    close,
    getPort,
  };
};
