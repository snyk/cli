import type { IncomingMessage, OutgoingHttpHeaders, RequestOptions } from 'http';

export interface Payload {
  body: any;
  url: string;
  headers: OutgoingHttpHeaders;
  method: RequestOptions['method'];
  qs?: {};
  json?: boolean;
  timeout?: number;
  family?: number;
}

export type SnykResponse = { res: IncomingMessage; body: any }
