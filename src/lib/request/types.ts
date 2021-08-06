import { OutgoingHttpHeaders } from 'http';
import { NeedleHttpVerbs } from 'needle';
import { ParsedUrlQueryInput } from 'querystring';

export interface Payload {
  body: any;
  url: string;
  headers: OutgoingHttpHeaders;
  method: NeedleHttpVerbs;
  qs?: ParsedUrlQueryInput;
  json?: boolean;
  timeout?: number;
  family?: number;
}
