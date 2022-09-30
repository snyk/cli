import * as needle from 'needle';
import { OutgoingHttpHeaders } from 'http';
import { NeedleHttpVerbs } from 'needle';
import { makeRequest } from '../request/index';
import { getAuthHeader } from '../api-token';
import config from '../config';
import { Payload } from '../request/types';

interface RequestInfo {
  method: NeedleHttpVerbs;
  path: string;
  body: any;
  headers?: OutgoingHttpHeaders;
  qs?: {};
  json?: boolean;
  timeout?: number;
  family?: number;
}

export async function snykHttpClient(
  requestInfo: RequestInfo,
): Promise<{
  res: needle.NeedleResponse;
  body: any;
}> {
  let { path } = requestInfo;
  if (!path.startsWith('/')) path = `/${path}`;

  const payload: Payload = {
    ...requestInfo,
    url: `${config.API_REST_URL}${path}`,
    headers: {
      ...requestInfo.headers,
      Authorization: getAuthHeader(),
    },
  };

  return makeRequest(payload);
}
