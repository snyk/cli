import * as express from 'express';
import * as http from 'http';

export class NewFakeServer {
  // accessing this from When.then is why I wanted When to be an inner class of NewFakeServer but JS/TS doesn't have inner classes
  public endpointConfigs: EndpointConfig[] = [];

  private _port: number;
  private baseApi = '/api';
  private app: express.Express;
  private server: http.Server | undefined;
  private router: express.Router;

  constructor() {
    this._port = 5000;
    this.app = express();
    // this.router = express.Router();

    const dynamicRoutesMiddleware = (
      req: express.Request,
      res: express.Response,
      // next: express.NextFunction,
    ) => {
      for (const endpointConfig of this.endpointConfigs) {
        if (
          req.path === endpointConfig.endpoint.path &&
          req.method === endpointConfig.endpoint.method.toUpperCase()
        ) {
          res.send(endpointConfig.responder.getResponse());
        }
      }

      res.send('endpoint not defined');
      // next();
    };

    this.app.use(dynamicRoutesMiddleware);
    this.app.get('/test', this.testHandler);
    // this.app.use('/', this.router);
  }

  testHandler(req: express.Request, res: express.Response): void {
    res.send('ok');
  }

  public reset(): void {
    this.endpointConfigs = [];
  }

  public get port(): number {
    return this._port;
  }

  public async start(): Promise<void> {
    const theApp = this.app;
    return new Promise((resolve) => {
      this.server = theApp.listen(this._port, () => {
        console.log(
          `NewFakeServer listening on http://localhost:${this._port}`,
        );
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    if (server) {
      return new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  public when(endpoint: Endpoint): When {
    return new When(this, endpoint);
  }
}

type ResponderFn = () => any;

type Endpoint = {
  path: string;
  method: 'get' | 'post';
};

type EndpointConfig = {
  endpoint: Endpoint;
  responder: Responder;
};

interface Responder {
  getResponse(): any;
}

class DataResponder implements Responder {
  constructor(private data: any) {}

  getResponse(): any {
    return this.data;
  }
}

class CallbackResponder implements Responder {
  constructor(private responderFn: ResponderFn) {}

  getResponse(): any {
    return this.responderFn();
  }
}

class When {
  constructor(private server: NewFakeServer, private endpoint: Endpoint) {}

  public respondWith(responderFn: ResponderFn) {
    // accessing this from When.then is why I wanted When to be an inner class of NewFakeServer but JS/TS doesn't have inner classes
    this.server.endpointConfigs.push({
      endpoint: this.endpoint,
      responder: new CallbackResponder(responderFn),
    });
  }

  public respondWithData(data: any) {
    this.server.endpointConfigs.push({
      endpoint: this.endpoint,
      responder: new DataResponder(data),
    });
  }
}
