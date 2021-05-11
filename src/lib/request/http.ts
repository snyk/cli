import * as http from 'http';
import * as https from 'https';
import { RequestOptions } from 'https';
import { SnykResponse } from './types';

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
