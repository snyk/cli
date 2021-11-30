import http from 'http';
import https from 'https';
import { IncomingMessage } from 'http';
import { RequestOptions } from 'https';

export type SnykResponse = { res: IncomingMessage; body: any };

export async function request(
  url: string,
  data?: string | Buffer,
  options: RequestOptions = {},
): Promise<SnykResponse> {
  return new Promise((resolve, reject) => {
    const client = new URL(url).protocol === 'https:' ? https : http;
    const requestOptions = {
      ...options,
      agent: new client.Agent({ keepAlive: true }),
    };
    const request = client.request(url, requestOptions, (response) => {
      const body: any[] = [];
      response.on('data', (chunk: any) => body.push(Buffer.from(chunk)));
      response.on('end', () =>
        resolve({ res: response, body: Buffer.concat(body).toString('utf-8') }),
      );
    });
    request.on('error', reject);

    if (data) {
      request.write(data);
    }
    request.end();
  });
}

export function postJson(
  url: string,
  jsonData: any,
  options: RequestOptions = {},
): Promise<SnykResponse> {
  const jsonString = JSON.stringify(jsonData);
  const requestOptions = {
    ...options,
    method: 'POST',
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  };
  return request(url, jsonString, requestOptions);
}
