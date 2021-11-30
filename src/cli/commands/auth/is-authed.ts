import config from '../../../lib/config';
import { apiTokenExists } from '../../../lib/api-token';
import { makeRequest } from '../../../lib/request';
import { AuthFailedError } from '../../../lib/errors/authentication-failed-error';

export async function isAuthed(): Promise<void> {
  const token = apiTokenExists();
  const res = await verifyAPI(token);
  if (!res.body.ok) {
    throw new AuthFailedError(res.body.userMessage, res.statusCode);
  }
}

export async function verifyAPI(api: string): Promise<any> {
  const { res } = await makeRequest({
    body: {
      api,
    },
    method: 'POST',
    url: config.API + '/verify/token',
    json: true,
  });
  return res;
}
