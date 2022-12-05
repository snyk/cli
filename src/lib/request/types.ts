import { OutgoingHttpHeaders } from 'http';
import { NeedleHttpVerbs } from 'needle';

export interface Payload {
  body: any;
  url: string;
  headers: OutgoingHttpHeaders;
  method: NeedleHttpVerbs;
  qs?: {};
  json?: boolean;
  parse?: boolean;
  timeout?: number;
  family?: number;
  noCompression?: boolean;
}
